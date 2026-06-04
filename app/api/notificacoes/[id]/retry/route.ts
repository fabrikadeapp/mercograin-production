/**
 * POST /api/notificacoes/[id]/retry
 *
 * Tenta reenviar uma notificação que falhou. Reusa o texto e o destinatário
 * já registrados em NotificacaoEntrega. Incrementa retryCount.
 *
 * Não cria nova entrada — atualiza o registro existente com status novo.
 * Histórico de tentativas fica em retryCount + retryEm. Se quiser detalhe
 * por tentativa, vire append-only futuro.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { sendText, EvolutionError } from '@/lib/whatsapp/evolution'
import { sendEmail } from '@/lib/email/send'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const notif = await db.notificacaoEntrega.findFirst({
      where: { id: params.id, workspaceId: scope.workspaceId },
    })
    if (!notif) {
      return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 })
    }

    if (!notif.texto) {
      return NextResponse.json(
        { error: 'Notificação sem texto registrado, não dá pra reenviar' },
        { status: 409 }
      )
    }

    if (notif.canal === 'whatsapp') {
      const instancia = await db.whatsAppInstance.findUnique({
        where: { workspaceId: scope.workspaceId },
        select: { instanceName: true, status: true },
      })
      if (!instancia || instancia.status !== 'connected') {
        return NextResponse.json(
          { error: 'Instância WhatsApp não está conectada' },
          { status: 409 }
        )
      }
      try {
        const r = await sendText(instancia.instanceName, notif.destinatario, notif.texto)
        await db.notificacaoEntrega.update({
          where: { id: notif.id },
          data: {
            status: 'enviado',
            providerStatus: 'sent',
            providerStatusEm: new Date(),
            providerMessageId: r.messageId,
            errorMotivo: null,
            errorCodigo: null,
            retryCount: { increment: 1 },
            retryEm: new Date(),
          },
        })
        return NextResponse.json({ ok: true, messageId: r.messageId })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'erro'
        await db.notificacaoEntrega.update({
          where: { id: notif.id },
          data: {
            status: 'falhou',
            errorMotivo: errMsg.slice(0, 1000),
            errorCodigo: err instanceof EvolutionError ? String(err.status) : null,
            retryCount: { increment: 1 },
            retryEm: new Date(),
          },
        })
        return NextResponse.json(
          { error: 'Reenvio falhou', motivo: errMsg },
          { status: 502 }
        )
      }
    }

    if (notif.canal === 'email') {
      const r = await sendEmail({
        to: notif.destinatario,
        subject: notif.assunto ?? 'Reenvio',
        html: notif.texto,
        text: notif.texto.replace(/<[^>]+>/g, ''),
      })
      if (!r) {
        await db.notificacaoEntrega.update({
          where: { id: notif.id },
          data: {
            errorMotivo: 'send_returned_null (sem API key ou falha)',
            retryCount: { increment: 1 },
            retryEm: new Date(),
          },
        })
        return NextResponse.json({ error: 'Reenvio falhou' }, { status: 502 })
      }
      await db.notificacaoEntrega.update({
        where: { id: notif.id },
        data: {
          status: 'enviado',
          providerStatus: 'sent',
          providerStatusEm: new Date(),
          providerMessageId: r.id,
          errorMotivo: null,
          errorCodigo: null,
          retryCount: { increment: 1 },
          retryEm: new Date(),
        },
      })
      return NextResponse.json({ ok: true, messageId: r.id })
    }

    return NextResponse.json({ error: `Canal desconhecido: ${notif.canal}` }, { status: 409 })
  } catch (error) {
    console.error('Retry notif error:', error)
    return NextResponse.json({ error: 'Erro ao processar retry' }, { status: 500 })
  }
}
