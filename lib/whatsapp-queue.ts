/**
 * WhatsApp Queue - Bull job queue for async message sending
 * Ensures messages are sent even if connection temporarily fails
 */

import Queue from 'bull'
import { sendWhatsAppMessage, sendTemplateMessage } from './whatsapp-service'
import { db } from './db'
import { redis } from './redis'

// Define job types
export type WhatsAppJobType = 'send_message' | 'send_template' | 'send_proposal' | 'send_contract'

export interface WhatsAppMessage {
  type: WhatsAppJobType
  phoneNumber: string
  message?: string
  templateName?: string
  templateVars?: Record<string, string>
  proposalId?: string
  contractId?: string
  userId: string
}

// Create queue
const whatsappQueue = new Queue<WhatsAppMessage>('whatsapp-notifications', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
})

/**
 * Process jobs from queue
 */
whatsappQueue.process(async (job) => {
  const { type, phoneNumber, message, templateName, templateVars } = job.data

  console.log(`[WhatsApp Queue] Processando job: ${job.id} - ${type}`)

  try {
    let result

    if (type === 'send_message' && message) {
      result = await sendWhatsAppMessage(phoneNumber, message)
    } else if (type === 'send_template' && templateName && templateVars) {
      result = await sendTemplateMessage(phoneNumber, templateName, templateVars)
    } else {
      throw new Error(`Tipo de job desconhecido: ${type}`)
    }

    if (!result.success) {
      throw new Error(result.error || 'Erro desconhecido')
    }

    console.log(`[WhatsApp Queue] Job ${job.id} completado com sucesso`)
    return result
  } catch (error) {
    console.error(`[WhatsApp Queue] Job ${job.id} falhou:`, error)

    // Retry logic: Bull automatically retries (3x by default)
    throw error
  }
})

/**
 * Listen to events
 */
whatsappQueue.on('completed', (job) => {
  console.log(`[WhatsApp Queue] ✅ Completado: ${job.id}`)
})

whatsappQueue.on('failed', (job, err) => {
  console.error(`[WhatsApp Queue] ❌ Falhou: ${job.id} - ${err.message}`)
})

whatsappQueue.on('error', (err) => {
  console.error(`[WhatsApp Queue] ❌ Erro na fila:`, err)
})

/**
 * Add message to queue
 */
export async function queueWhatsAppMessage(
  messageData: WhatsAppMessage,
  options?: { delay?: number; priority?: number }
): Promise<string> {
  try {
    const job = await whatsappQueue.add(messageData, {
      attempts: 3, // Retry 3 times on failure
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2 seconds
      },
      removeOnComplete: true, // Clean up completed jobs
      removeOnFail: false, // Keep failed jobs for debugging
      delay: options?.delay,
      priority: options?.priority,
    })

    console.log(`[WhatsApp Queue] Mensagem enfileirada: ${job.id}`)
    return job.id.toString()
  } catch (error) {
    console.error('[WhatsApp Queue] Erro ao enfileirar mensagem:', error)
    throw error
  }
}

/**
 * Queue proposal sent notification
 */
export async function queueProposalNotification(
  phoneNumber: string,
  proposalNumber: string,
  clienteName: string,
  proposalType: string,
  value: string,
  validity: string,
  userId: string
): Promise<string> {
  return queueWhatsAppMessage({
    type: 'send_template',
    phoneNumber,
    templateName: 'proposal_sent',
    templateVars: {
      clienteName,
      proposalNumber,
      type: proposalType === 'venda' ? 'Venda' : 'Compra',
      value,
      validity,
    },
    proposalId: proposalNumber,
    userId,
  })
}

/**
 * Queue contract created notification
 */
export async function queueContractNotification(
  phoneNumber: string,
  contractNumber: string,
  proposalNumber: string,
  userId: string
): Promise<string> {
  return queueWhatsAppMessage({
    type: 'send_template',
    phoneNumber,
    templateName: 'contract_created',
    templateVars: {
      contractNumber,
      proposalNumber,
    },
    contractId: contractNumber,
    userId,
  })
}

/**
 * Queue invoice/boleto notification
 */
export async function queueInvoiceNotification(
  phoneNumber: string,
  invoiceNumber: string,
  dueDate: string,
  amount: string,
  userId: string
): Promise<string> {
  return queueWhatsAppMessage({
    type: 'send_template',
    phoneNumber,
    templateName: 'invoice_generated',
    templateVars: {
      invoiceNumber,
      dueDate,
      amount,
    },
    userId,
  })
}

/**
 * Get queue stats
 */
export async function getQueueStats() {
  try {
    const counts = await whatsappQueue.getJobCounts()
    return {
      active: counts.active,
      waiting: counts.waiting,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
    }
  } catch (error) {
    console.error('[WhatsApp Queue] Erro ao obter stats:', error)
    return null
  }
}

/**
 * Clear failed jobs (admin only)
 */
export async function clearFailedJobs() {
  try {
    await whatsappQueue.clean(0, 'failed') // Clean all failed jobs
    console.log('[WhatsApp Queue] Jobs falhados limpos')
  } catch (error) {
    console.error('[WhatsApp Queue] Erro ao limpar jobs:', error)
  }
}

export default whatsappQueue
