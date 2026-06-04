/**
 * Helper centralizado de envio automático de notificações por WhatsApp.
 *
 * Lógica: se o workspace tem WhatsAppInstance.status === 'connected' E
 * variável de ambiente DISABLE_WHATSAPP_AUTO_NOTIF não estiver setada,
 * envia best-effort via Evolution API.
 *
 * Erros nunca propagam — apenas log + return null.
 * Audit em WebhookLog (tipo: 'whatsapp_send_auto').
 */

import { db } from '@/lib/db'
import { sendText, EvolutionError } from './evolution'

export interface NotificarArgs {
  workspaceId: string
  /** Número E.164 puro (5511999999999) ou com símbolos. Será normalizado. */
  para: string | null | undefined
  /** Texto pronto (use templates de lib/whatsapp/templates). */
  texto: string
  /** Categoria pra audit. */
  categoria:
    | 'proposta_enviada_cliente'
    | 'proposta_aceita_time'
    | 'contrato_gerado_cliente'
  /** Metadata pra audit (propostaId, contratoId, etc). */
  meta?: Record<string, unknown>
}

export interface NotificarResult {
  enviado: boolean
  messageId?: string
  motivo?: string
}

function limparTelefone(raw: string): string {
  return raw.replace(/\D/g, '')
}

function disabledByEnv(): boolean {
  const v = process.env.DISABLE_WHATSAPP_AUTO_NOTIF
  return v === 'true' || v === '1' || v === 'yes'
}

export async function notificarPorWhats(args: NotificarArgs): Promise<NotificarResult> {
  if (disabledByEnv()) {
    return { enviado: false, motivo: 'desabilitado_por_env' }
  }
  if (!args.para) {
    return { enviado: false, motivo: 'sem_telefone' }
  }
  const numero = limparTelefone(args.para)
  if (numero.length < 10) {
    return { enviado: false, motivo: 'telefone_invalido' }
  }

  // Workspace tem WhatsApp ligado?
  const instancia = await db.whatsAppInstance.findUnique({
    where: { workspaceId: args.workspaceId },
    select: { instanceName: true, status: true },
  })
  if (!instancia || instancia.status !== 'connected') {
    return { enviado: false, motivo: 'instancia_offline' }
  }

  try {
    const r = await sendText(instancia.instanceName, numero, args.texto)
    // Audit best-effort
    db.webhookLog
      .create({
        data: {
          tipo: 'whatsapp_send_auto',
          payload: {
            categoria: args.categoria,
            number: numero,
            text: args.texto.slice(0, 500),
            messageId: r.messageId,
            workspaceId: args.workspaceId,
            ...(args.meta ?? {}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          status: 'processado',
          mensagem: `${args.categoria} → ${numero}`,
        },
      })
      .catch(() => undefined)
    return { enviado: true, messageId: r.messageId }
  } catch (err) {
    const motivo = err instanceof EvolutionError ? `evolution_${err.status}` : 'erro_envio'
    db.webhookLog
      .create({
        data: {
          tipo: 'whatsapp_send_auto',
          payload: {
            categoria: args.categoria,
            number: numero,
            workspaceId: args.workspaceId,
            error: err instanceof Error ? err.message : 'unknown',
            ...(args.meta ?? {}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          status: 'erro',
          mensagem: motivo,
          codigoErro: err instanceof EvolutionError ? String(err.status) : null,
        },
      })
      .catch(() => undefined)
    return { enviado: false, motivo }
  }
}
