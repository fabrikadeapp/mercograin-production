/**
 * POST /api/whatsapp/send
 * Envia mensagem de texto via Evolution API (instância do workspace) e registra log.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireScope } from '@/lib/auth/scope'
import { sendText, EvolutionError } from '@/lib/whatsapp/evolution'
import { ensureInstance as ensureWorkspaceInstance } from '@/lib/whatsapp/instance-resolver'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'

const sendSchema = z.object({
  number: z.string().min(8, 'Número inválido'),
  text: z.string().min(1, 'Mensagem vazia').max(4096),
})

export async function POST(request: NextRequest) {
  try {
    const scope = await requireScope()

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

    const wsInstance = await ensureWorkspaceInstance(scope.workspaceId)

    let result: { messageId: string }
    try {
      result = await sendText(wsInstance.instanceName, number, text)
    } catch (err) {
      const status = err instanceof EvolutionError ? err.status : 500
      const message = err instanceof Error ? err.message : 'Falha no envio'

      await db.webhookLog
        .create({
          data: {
            tipo: 'whatsapp_send',
            payload: {
              number,
              text,
              error: message,
              workspaceId: scope.workspaceId,
              instanceName: wsInstance.instanceName,
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

    await db.webhookLog
      .create({
        data: {
          tipo: 'whatsapp_send',
          payload: {
            number,
            text,
            messageId: result.messageId,
            userId: scope.userId,
            workspaceId: scope.workspaceId,
            instanceName: wsInstance.instanceName,
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
    const message =
      error instanceof Error ? error.message : 'Erro ao enviar mensagem'
    if (message === 'Não autorizado') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    console.error('[whatsapp/send] erro:', error)
    return NextResponse.json(
      { error: message, status: 500 },
      { status: 500 }
    )
  }
}
