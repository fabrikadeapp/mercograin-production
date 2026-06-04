/**
 * Wrapper de envio de email com rastreamento em NotificacaoEntrega.
 *
 * Usar apenas para notificações outbound do ciclo proposta→contrato que
 * precisam aparecer no dashboard de saúde. Emails genéricos (welcome,
 * password reset, etc) continuam usando sendEmail() direto.
 */

import { db } from './../db'
import { sendEmail, type SendEmailParams } from './send'

export interface SendEmailRastreadoParams extends SendEmailParams {
  workspaceId: string
  /** Categoria semântica. Convenção: `<acao>_<destino>_email`. */
  categoria: string
  /** Nome do destinatário (pra exibição). */
  destinatarioNome?: string
  /** Metadata estruturada para correlação (propostaId, contratoId, etc). */
  meta?: Record<string, unknown>
}

export interface SendEmailRastreadoResult {
  ok: boolean
  messageId?: string
  motivo?: string
}

export async function sendEmailRastreado(
  p: SendEmailRastreadoParams
): Promise<SendEmailRastreadoResult> {
  const destinatario = Array.isArray(p.to) ? p.to[0] : p.to
  try {
    const r = await sendEmail({
      to: p.to,
      subject: p.subject,
      html: p.html,
      text: p.text,
      replyTo: p.replyTo,
      tags: p.tags,
    })
    if (r) {
      db.notificacaoEntrega
        .create({
          data: {
            workspaceId: p.workspaceId,
            canal: 'email',
            categoria: p.categoria,
            destinatario,
            destinatarioNome: p.destinatarioNome,
            status: 'enviado',
            providerStatus: 'sent',
            providerStatusEm: new Date(),
            providerMessageId: r.id,
            assunto: p.subject,
            texto: (p.text ?? p.html ?? '').slice(0, 2000),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            meta: (p.meta ?? null) as any,
          },
        })
        .catch(() => undefined)
      return { ok: true, messageId: r.id }
    }
    // sendEmail retornou null — sem RESEND_API_KEY ou falha silenciosa
    db.notificacaoEntrega
      .create({
        data: {
          workspaceId: p.workspaceId,
          canal: 'email',
          categoria: p.categoria,
          destinatario,
          destinatarioNome: p.destinatarioNome,
          status: 'falhou',
          assunto: p.subject,
          texto: (p.text ?? p.html ?? '').slice(0, 2000),
          errorMotivo: 'send_returned_null (sem API key ou falha provider)',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          meta: (p.meta ?? null) as any,
        },
      })
      .catch(() => undefined)
    return { ok: false, motivo: 'send_returned_null' }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'unknown'
    db.notificacaoEntrega
      .create({
        data: {
          workspaceId: p.workspaceId,
          canal: 'email',
          categoria: p.categoria,
          destinatario,
          destinatarioNome: p.destinatarioNome,
          status: 'falhou',
          assunto: p.subject,
          texto: (p.text ?? p.html ?? '').slice(0, 2000),
          errorMotivo: errMsg.slice(0, 1000),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          meta: (p.meta ?? null) as any,
        },
      })
      .catch(() => undefined)
    return { ok: false, motivo: errMsg }
  }
}
