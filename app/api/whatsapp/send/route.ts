/**
 * POST /api/whatsapp/send
 * Envia mensagem de texto via Evolution API e registra log em WebhookLog.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { sendText, EvolutionError } from '@/lib/whatsapp/evolution'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'

const sendSchema = z.object({
  number: z.string().min(8, 'Número inválido'),
  text: z.string().min(1, 'Mensagem vazia').max(4096),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const ip = getClientIp(request)
    const limit = rateLimit(`whatsapp-send:${ip}`, 30, 60_000)
    if (!limit.ok) {
      return NextResponse.json(
        {
          error:
            'Muitas mensagens. Tente em ' +
            Math.ceil(limit.resetIn / 1000) +
            's',
        },
        { status: 429 }
      )
    }

    const json = await request.json().catch(() => null)
    const parsed = sendSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
        { status: 400 }
      )
    }
    const { number, text } = parsed.data

    let result: { messageId: string }
    try {
      result = await sendText(number, text)
    } catch (err) {
      const status = err instanceof EvolutionError ? err.status : 500
      const message = err instanceof Error ? err.message : 'Falha no envio'

      await db.webhookLog
        .create({
          data: {
            tipo: 'whatsapp_send',
            payload: { number, text, error: message } as any,
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

    await db.webhookLog
      .create({
        data: {
          tipo: 'whatsapp_send',
          payload: {
            number,
            text,
            messageId: result.messageId,
            userId: session.user.id,
          } as any,
          status: 'processado',
          mensagem: `Enviado (${result.messageId})`,
        },
      })
      .catch(() => undefined)

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    })
  } catch (error) {
    console.error('[whatsapp/send] erro:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Erro ao enviar mensagem',
        status: 500,
      },
      { status: 500 }
    )
  }
}
