/**
 * POST /api/whatsapp/send
 * Send manual WhatsApp message (admin only)
 *
 * Body:
 * {
 *   "phoneNumber": "5511999999999",
 *   "message": "Hello world",
 *   "type": "text" | "template",
 *   "templateName": "proposal_sent" (if type=template),
 *   "templateVars": {...} (if type=template)
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sendWhatsAppMessage, sendTemplateMessage, testWhatsAppConnection } from '@/lib/whatsapp-service'
import { queueWhatsAppMessage } from '@/lib/whatsapp-queue'
import { db } from '@/lib/db'
import { z } from 'zod'

const sendMessageSchema = z.object({
  phoneNumber: z.string().min(10, 'Número inválido'),
  type: z.enum(['text', 'template']),
  message: z.string().optional(),
  templateName: z.string().optional(),
  templateVars: z.record(z.string()).optional(),
  queue: z.boolean().optional().default(false), // Use queue or send immediately
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    })

    if (user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso restrito a admins' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { phoneNumber, type, message, templateName, templateVars, queue } = sendMessageSchema.parse(body)

    let result: any

    if (queue) {
      // Queue for async sending
      const jobId = await queueWhatsAppMessage({
        type: type === 'text' ? 'send_message' : 'send_template',
        phoneNumber,
        message,
        templateName,
        templateVars,
        userId: session.user.id,
      })

      result = {
        success: true,
        method: 'queued',
        jobId,
        message: 'Mensagem enfileirada para envio',
      }
    } else {
      // Send immediately
      let sendResult

      if (type === 'text' && message) {
        sendResult = await sendWhatsAppMessage(phoneNumber, message)
      } else if (type === 'template' && templateName && templateVars) {
        sendResult = await sendTemplateMessage(phoneNumber, templateName, templateVars)
      } else {
        return NextResponse.json(
          { error: 'Dados inválidos para tipo de mensagem' },
          { status: 400 }
        )
      }

      result = {
        success: sendResult.success,
        method: 'immediate',
        messageId: sendResult.messageId,
        message: sendResult.success ? 'Mensagem enviada' : `Erro: ${sendResult.error}`,
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Error sending message:', error)
    return NextResponse.json(
      {
        error: 'Erro ao enviar mensagem',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/whatsapp/send?phone=5511999999999
 * Test message to given phone number
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    })

    if (user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso restrito a admins' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json(
        { error: 'Parâmetro "phone" é obrigatório' },
        { status: 400 }
      )
    }

    // Test connection
    const result = await testWhatsAppConnection(phone)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error testing connection:', error)
    return NextResponse.json(
      {
        success: false,
        message: `Erro: ${error instanceof Error ? error.message : 'Unknown'}`,
      },
      { status: 500 }
    )
  }
}
