/**
 * POST /api/propostas/[id]/send-whatsapp
 * Send WhatsApp notification when proposal is sent.
 *
 * Refactored (Sem 4.15) — agora usa lib/whatsapp/evolution.ts diretamente, sem
 * fila Bull/Redis. Síncrono. A pilha legacy (lib/whatsapp-queue.ts +
 * lib/whatsapp-service.ts) está deprecada e não tem mais consumers.
 *
 * Body:
 * {
 *   "phoneNumber": "5511999999999" (optional, uses cliente whatsapp if not provided)
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { sendText, EvolutionError } from '@/lib/whatsapp/evolution'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { z } from 'zod'

const sendWhatsAppSchema = z.object({
  phoneNumber: z.string().optional(),
})

const SUFFIX = '\n\n_PHB Grain · Trading de Grãos_'

interface GraoItem {
  grao?: string
  quantidade?: number
  preco?: number
  subtotal?: number
}

function buildProposalMessage(args: {
  clienteNome: string
  numero: string
  tipo: string
  valor: string
  validade: string
  graos: GraoItem[]
}): string {
  const { clienteNome, numero, tipo, valor, validade, graos } = args
  const tipoLabel = tipo === 'venda' ? 'Venda' : tipo === 'compra' ? 'Compra' : tipo
  const linhas: string[] = []
  linhas.push(`🌾 *Nova proposta — PHB Grain*`)
  linhas.push('')
  linhas.push(`Olá ${clienteNome},`)
  linhas.push('')
  linhas.push(`Você recebeu a proposta nº *${numero}* (${tipoLabel}).`)

  if (graos.length > 0) {
    linhas.push('')
    for (const g of graos.slice(0, 5)) {
      const nomeGrao = (g.grao || '').toString()
      const qtd = g.quantidade ?? 0
      const preco = g.preco ?? 0
      linhas.push(`📦 ${nomeGrao} · ${qtd} sc · R$ ${preco.toFixed(2)}/sc`)
    }
    if (graos.length > 5) {
      linhas.push(`… e mais ${graos.length - 5} ${graos.length - 5 === 1 ? 'item' : 'itens'}`)
    }
  }

  linhas.push('')
  linhas.push(`💰 Total: ${valor}`)
  linhas.push(`📅 Válida até ${validade}`)
  return linhas.join('\n') + SUFFIX
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { phoneNumber: providedPhone } = sendWhatsAppSchema.parse(body)

    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            whatsapp: true,
            workspaceId: true,
          },
        },
      },
    })

    if (!proposta) {
      return NextResponse.json(
        { error: 'Proposta não encontrada' },
        { status: 404 }
      )
    }

    // Validação de telefone — preserva lógica original.
    const phoneNumber = providedPhone || proposta.cliente.whatsapp
    if (!phoneNumber) {
      return NextResponse.json(
        {
          error: 'Número WhatsApp não fornecido',
          message:
            'O cliente não possui número WhatsApp registrado. Envie manualmente ou registre o número.',
        },
        { status: 400 }
      )
    }

    const valor =
      typeof proposta.valorTotal === 'number'
        ? proposta.valorTotal
        : Number(proposta.valorTotal)

    const graos: GraoItem[] = Array.isArray(proposta.graos)
      ? (proposta.graos as GraoItem[])
      : []

    const message = buildProposalMessage({
      clienteNome: proposta.cliente.nome,
      numero: proposta.numero,
      tipo: proposta.tipo,
      valor: formatCurrency(valor),
      validade: formatDate(proposta.validadeEm),
      graos,
    })

    try {
      const result = await sendText(phoneNumber, message)

      // Log de auditoria (best-effort).
      await db.webhookLog
        .create({
          data: {
            tipo: 'whatsapp_send',
            payload: {
              number: phoneNumber,
              text: message,
              messageId: result.messageId,
              template: 'proposal_sent',
              propostaId: proposta.id,
              userId: scope.userId,
            } as any,
            status: 'processado',
            mensagem: `Proposta ${proposta.numero} enviada (${result.messageId})`,
          },
        })
        .catch(() => undefined)

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: `Notificação WhatsApp enviada para ${phoneNumber}`,
        phone: phoneNumber.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3'),
      })
    } catch (err) {
      const status = err instanceof EvolutionError ? err.status : 500
      const errorMessage = err instanceof Error ? err.message : 'Falha no envio'

      await db.webhookLog
        .create({
          data: {
            tipo: 'whatsapp_send',
            payload: {
              number: phoneNumber,
              text: message,
              error: errorMessage,
              propostaId: proposta.id,
            } as any,
            status: 'erro',
            mensagem: errorMessage,
            codigoErro: String(status),
          },
        })
        .catch(() => undefined)

      return NextResponse.json(
        {
          error: 'Erro ao enviar WhatsApp',
          message: errorMessage,
        },
        { status: status >= 400 && status < 600 ? status : 500 }
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Error sending WhatsApp:', error)
    return NextResponse.json(
      {
        error: 'Erro ao enviar WhatsApp',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
