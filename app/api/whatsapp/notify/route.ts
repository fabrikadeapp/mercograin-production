/**
 * POST /api/whatsapp/notify
 * Notificação automatizada baseada em template (boleto, contrato, cotação, custom).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { requireScope } from '@/lib/auth/scope'
import { sendText, EvolutionError } from '@/lib/whatsapp/evolution'
import { db } from '@/lib/db'

const SUFFIX = '\n\n_PHB Grain · Trading de Grãos_'

const notifySchema = z
  .object({
    targetType: z.enum(['cliente', 'numero']),
    targetId: z.string().optional(),
    number: z.string().optional(),
    template: z.enum([
      'boleto_vencendo',
      'contrato_assinado',
      'cotacao_alerta',
      'custom',
    ]),
    data: z.record(z.any()).default({}),
  })
  .refine(
    (v) =>
      (v.targetType === 'cliente' && !!v.targetId) ||
      (v.targetType === 'numero' && !!v.number),
    { message: 'targetId obrigatório para cliente, number para numero' }
  )

function render(
  template: string,
  data: Record<string, any>
): string | { error: string } {
  switch (template) {
    case 'boleto_vencendo':
      return `Olá ${data.clienteNome ?? ''}! 👋 Seu boleto BLT-${
        data.numero ?? ''
      } no valor de R$ ${data.valor ?? ''} vence em ${
        data.vencimento ?? ''
      }. Pague pelo link: ${data.link ?? ''}${SUFFIX}`
    case 'contrato_assinado':
      return `Contrato CT-${data.numero ?? ''} assinado com sucesso! ✅ Acesse os detalhes em ${
        data.link ?? ''
      }${SUFFIX}`
    case 'cotacao_alerta':
      return `🚨 Alerta de cotação: ${data.grao ?? ''} atingiu R$ ${
        data.preco ?? ''
      } (${data.delta ?? ''}%). Configure novos alertas em ${
        data.link ?? ''
      }${SUFFIX}`
    case 'custom':
      if (!data.text || typeof data.text !== 'string') {
        return { error: 'data.text obrigatório para template custom' }
      }
      return `${data.text}${SUFFIX}`
    default:
      return { error: 'Template desconhecido' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const scope = await requireScope()

    const body = await request.json().catch(() => null)
    const parsed = notifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
        { status: 400 }
      )
    }

    const { targetType, targetId, number, template, data } = parsed.data

    // Resolve número
    let resolvedNumber = number ?? ''
    if (targetType === 'cliente' && targetId) {
      const cliente = await db.cliente.findFirst({
        where: { id: targetId, workspaceId: scope.workspaceId },
        select: { whatsapp: true, telefone: true, nome: true },
      })
      if (!cliente) {
        return NextResponse.json(
          { error: 'Cliente não encontrado' },
          { status: 404 }
        )
      }
      resolvedNumber = (cliente.whatsapp || cliente.telefone || '').trim()
      if (!resolvedNumber) {
        return NextResponse.json(
          { error: 'Cliente sem WhatsApp/telefone cadastrado' },
          { status: 400 }
        )
      }
      if (!data.clienteNome) data.clienteNome = cliente.nome
    }

    const rendered = render(template, data)
    if (typeof rendered !== 'string') {
      return NextResponse.json({ error: rendered.error }, { status: 400 })
    }

    try {
      const r = await sendText(resolvedNumber, rendered)
      await db.webhookLog
        .create({
          data: {
            tipo: 'whatsapp_send',
            payload: {
              number: resolvedNumber,
              text: rendered,
              messageId: r.messageId,
              template,
              targetType,
              targetId: targetId ?? null,
              userId: session.user.id,
            } as any,
            status: 'processado',
            mensagem: `Notify ${template} (${r.messageId})`,
          },
        })
        .catch(() => undefined)
      return NextResponse.json({ success: true, messageId: r.messageId })
    } catch (err) {
      const status = err instanceof EvolutionError ? err.status : 500
      const message = err instanceof Error ? err.message : 'Falha no envio'
      await db.webhookLog
        .create({
          data: {
            tipo: 'whatsapp_send',
            payload: {
              number: resolvedNumber,
              text: rendered,
              template,
              error: message,
            } as any,
            status: 'erro',
            mensagem: message,
            codigoErro: String(status),
          },
        })
        .catch(() => undefined)
      return NextResponse.json(
        { error: message, status },
        { status: status >= 400 && status < 600 ? status : 500 }
      )
    }
  } catch (error) {
    console.error('[whatsapp/notify] erro:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro interno',
      },
      { status: 500 }
    )
  }
}
