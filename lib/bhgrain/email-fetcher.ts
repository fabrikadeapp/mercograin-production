/**
 * BH Grain — Worker IMAP que polla mailboxes de workspaces com credencial
 * de email habilitada e popula Conversation(channel='email').
 *
 * Estratégia:
 *  - Idempotência: campo `lastSeenUidValidity` + `lastSeenUid` armazenado em
 *    IntegrationCredential.config como { lastSeenUid, lastSeenUidValidity }
 *    para evitar reprocessar mensagens já vistas.
 *  - Janela máxima: 50 mensagens novas por workspace por execução (evita
 *    explodir em primeira sync grande).
 *  - Falha silenciosa por workspace — erros não param o batch.
 *  - Atualiza IntegrationHealth(integration='email') ao final de cada workspace.
 */

import { ImapFlow } from 'imapflow'
import { db } from '@/lib/db'
import { getSecret } from './credentials'
import type { Prisma } from '@prisma/client'

const FETCH_BATCH_LIMIT = 50

export interface FetchStats {
  workspaceId: string
  novasMensagens: number
  conversasCriadas: number
  conversasAtualizadas: number
  ok: boolean
  error?: string
}

interface EmailConfigStored {
  imapHost: string
  imapPort: number
  imapUser: string
  imapTls: boolean
  fromEmail?: string | null
  /** Estado do fetcher — gerenciado por este módulo */
  lastSeenUid?: number
  lastSeenUidValidity?: number
}

function asEmailConfig(raw: unknown): EmailConfigStored | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as EmailConfigStored
  if (!c.imapHost || !c.imapUser) return null
  return c
}

function extractEmail(headerValue: string | undefined): { name: string | null; email: string | null } {
  if (!headerValue) return { name: null, email: null }
  // Aceita "Nome <a@b.com>" ou "a@b.com"
  const m = headerValue.match(/^(?:"?([^"<]*?)"?\s*<)?([^\s<>]+@[^\s<>]+)>?$/)
  if (!m) return { name: null, email: null }
  return { name: m[1]?.trim() || null, email: m[2].toLowerCase() }
}

function snippet(body: string, max = 240): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, max)
}

/**
 * Legacy wrapper: itera a PRIMEIRA credencial do workspace.
 * Mantido para compat com callers que ainda pensam por workspace.
 * Para multi-conta, use fetchCredentialEmail(credentialId).
 */
export async function fetchWorkspaceEmail(workspaceId: string): Promise<FetchStats> {
  const cred = await db.integrationCredential.findFirst({
    where: { workspaceId, channel: 'email_imap_smtp', enabled: true },
    orderBy: [{ createdAt: 'asc' }],
  })
  if (!cred) {
    return { workspaceId, novasMensagens: 0, conversasCriadas: 0, conversasAtualizadas: 0, ok: true }
  }
  return fetchCredentialEmail(cred.id)
}

/**
 * Sincroniza UMA credencial específica de e-mail. Suporta multi-conta:
 * o cursor (lastSeenUid/lastSeenUidValidity) fica na credencial individual,
 * então N contas no mesmo workspace mantêm cursores independentes.
 */
export async function fetchCredentialEmail(credentialId: string): Promise<FetchStats> {
  const cred = await db.integrationCredential.findUnique({ where: { id: credentialId } })
  if (!cred || cred.channel !== 'email_imap_smtp') {
    return { workspaceId: cred?.workspaceId ?? '', novasMensagens: 0, conversasCriadas: 0, conversasAtualizadas: 0, ok: false, error: 'credencial inexistente' }
  }
  const { workspaceId } = cred
  if (!cred.enabled) {
    return { workspaceId, novasMensagens: 0, conversasCriadas: 0, conversasAtualizadas: 0, ok: true }
  }

  // Respeita toggle "Pausar e-mail" do health: cliente pode parar ingestão
  // temporariamente sem deletar credencial.
  const { isIntegrationPaused } = await import('./integration-pause')
  if (await isIntegrationPaused(workspaceId, 'email')) {
    return { workspaceId, novasMensagens: 0, conversasCriadas: 0, conversasAtualizadas: 0, ok: true, error: 'paused' }
  }
  const cfg = asEmailConfig(cred.config)
  if (!cfg) {
    return { workspaceId, novasMensagens: 0, conversasCriadas: 0, conversasAtualizadas: 0, ok: false, error: 'config inválida' }
  }

  // Decripta senha desta credencial específica (não a 1ª do workspace).
  const password = await (async () => {
    const secrets = (cred.secretsEncrypted ?? {}) as Record<string, string>
    const enc = secrets.imapPassword
    if (!enc) return null
    const { decryptSecret } = await import('./crypto-secret')
    return decryptSecret(enc, { workspaceId, channel: 'email_imap_smtp', field: 'imapPassword' })
  })()
  if (!password) {
    await markHealthError(workspaceId, `Senha IMAP não cadastrada (${cred.identifier ?? cred.id})`)
    return { workspaceId, novasMensagens: 0, conversasCriadas: 0, conversasAtualizadas: 0, ok: false, error: 'senha IMAP ausente' }
  }

  const client = new ImapFlow({
    host: cfg.imapHost,
    port: cfg.imapPort,
    secure: cfg.imapTls,
    auth: { user: cfg.imapUser, pass: password },
    logger: false,
    socketTimeout: 30_000,
    tls: { rejectUnauthorized: false },
  })

  let novas = 0
  let criadas = 0
  let atualizadas = 0

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      const mb = client.mailbox
      if (!mb || typeof mb === 'boolean') throw new Error('Mailbox INBOX inacessível')

      const uidValidity = Number(mb.uidValidity ?? 0)
      const uidNext = Number(mb.uidNext ?? 0)
      const lastUidValidity = cfg.lastSeenUidValidity ?? 0
      const lastUid = cfg.lastSeenUid ?? 0

      // Se uidvalidity mudou, o servidor recriou índices — vamos buscar somente os últimos N
      // ao invés de tudo desde 0 (que poderia inundar a inbox unificada).
      const startUid =
        uidValidity !== lastUidValidity
          ? Math.max(1, uidNext - FETCH_BATCH_LIMIT)
          : lastUid + 1

      if (startUid >= uidNext) {
        // Nada novo
        await updateLastSeen(cred.id, cfg, uidValidity, lastUid)
        await markHealthOk(workspaceId, 0)
        return { workspaceId, novasMensagens: 0, conversasCriadas: 0, conversasAtualizadas: 0, ok: true }
      }

      // Limita janela para FETCH_BATCH_LIMIT mensagens
      const endUid = Math.min(uidNext - 1, startUid + FETCH_BATCH_LIMIT - 1)
      let maxUidVisto = lastUid

      for await (const msg of client.fetch(
        { uid: `${startUid}:${endUid}` },
        { envelope: true, source: true, uid: true, internalDate: true }
      )) {
        novas++
        maxUidVisto = Math.max(maxUidVisto, Number(msg.uid))

        const env = msg.envelope ?? null
        const fromRaw = env?.from?.[0]
        const fromEmail = fromRaw?.address?.toLowerCase() ?? null
        const fromName = fromRaw?.name ?? null
        const subject = env?.subject ?? null
        const messageId = env?.messageId ?? `uid-${msg.uid}`
        const date = env?.date ?? msg.internalDate ?? new Date()

        if (!fromEmail) continue // sem remetente válido, ignora

        // Snippet do body (primeiros 240 chars de texto)
        let text: string | null = null
        if (msg.source) {
          const raw = msg.source.toString('utf8')
          // Busca delimitador entre headers e body (linha em branco)
          const splitIdx = raw.indexOf('\r\n\r\n')
          const body = splitIdx > 0 ? raw.slice(splitIdx + 4) : raw
          text = snippet(body)
        }
        const displayText = subject ? `${subject}\n\n${text ?? ''}`.trim() : text

        // Vincula a Cliente se houver match por email
        const cliente = await db.cliente.findFirst({
          where: { workspaceId, email: fromEmail },
          select: { id: true },
        })

        // Upsert Conversation: chave única inclui o ID da credencial para isolar
        // contas distintas no mesmo workspace (ex.: vendas@x e suporte@x recebem
        // do mesmo remetente). Formato: '<credId>:<fromEmail>'.
        const externalRef = `${cred.id}:${fromEmail}`
        const conv = await db.conversation.upsert({
          where: {
            workspaceId_channel_externalRef: {
              workspaceId,
              channel: 'email',
              externalRef,
            },
          },
          create: {
            workspaceId,
            channel: 'email',
            externalRef,
            clienteId: cliente?.id ?? null,
            contactName: fromName,
            contactHandle: fromEmail,
            lastMessageAt: date,
            unreadCount: 1,
            aiStatus: 'aguardando',
          },
          update: {
            contactName: fromName ?? undefined,
            clienteId: cliente?.id ?? undefined,
            lastMessageAt: date,
            unreadCount: { increment: 1 },
          },
        })
        // Conta criadas vs atualizadas (heurística: createdAt == updatedAt ± 100ms)
        if (Math.abs(conv.createdAt.getTime() - conv.updatedAt.getTime()) < 200) criadas++
        else atualizadas++

        // Persiste ConversationMessage idempotente (externalRef = messageId)
        await db.conversationMessage
          .create({
            data: {
              workspaceId,
              conversationId: conv.id,
              externalRef: messageId,
              direction: 'in',
              text: displayText,
              occurredAt: date,
            },
          })
          .catch((e: { code?: string }) => {
            // P2002 = duplicate (re-fetch da mesma mensagem) — ignora
            if (e?.code !== 'P2002') throw e
          })
      }

      await updateLastSeen(cred.id, cfg, uidValidity, maxUidVisto)
      await markHealthOk(workspaceId, novas)
    } finally {
      lock.release()
    }
    await client.logout()
    return { workspaceId, novasMensagens: novas, conversasCriadas: criadas, conversasAtualizadas: atualizadas, ok: true }
  } catch (e) {
    try { await client.logout() } catch { /* ignora */ }
    const msg = e instanceof Error ? e.message : 'erro IMAP'
    await markHealthError(workspaceId, msg)
    return { workspaceId, novasMensagens: novas, conversasCriadas: criadas, conversasAtualizadas: atualizadas, ok: false, error: msg }
  }
}

async function updateLastSeen(
  credId: string,
  cfgAtual: EmailConfigStored,
  uidValidity: number,
  uid: number
): Promise<void> {
  const newConfig: Prisma.InputJsonValue = {
    ...cfgAtual,
    lastSeenUid: uid,
    lastSeenUidValidity: uidValidity,
  } as unknown as Prisma.InputJsonValue
  await db.integrationCredential.update({
    where: { id: credId },
    data: { config: newConfig },
  })
}

async function markHealthOk(workspaceId: string, processados: number): Promise<void> {
  await db.integrationHealth.upsert({
    where: { workspaceId_integration: { workspaceId, integration: 'email' } },
    create: {
      workspaceId,
      integration: 'email',
      status: 'online',
      lastSuccessAt: new Date(),
      processedEvents: processados,
    },
    update: {
      status: 'online',
      lastSuccessAt: new Date(),
      processedEvents: { increment: processados },
      lastErrorMessage: null,
    },
  })
}

async function markHealthError(workspaceId: string, errorMsg: string): Promise<void> {
  await db.integrationHealth.upsert({
    where: { workspaceId_integration: { workspaceId, integration: 'email' } },
    create: {
      workspaceId,
      integration: 'email',
      status: 'erro',
      lastFailureAt: new Date(),
      lastErrorMessage: errorMsg.slice(0, 500),
    },
    update: {
      status: 'erro',
      lastFailureAt: new Date(),
      lastErrorMessage: errorMsg.slice(0, 500),
    },
  })
}

/**
 * Roda fetchWorkspaceEmail para todos workspaces com credencial enabled.
 * Tolerante a falha por workspace.
 */
/**
 * Itera TODAS as credenciais de e-mail habilitadas — multi-conta.
 * Um workspace pode ter N contas; cada uma é sincronizada com cursor próprio.
 *
 * Sequencial — IMAP é I/O bound mas servidores remotos rate-limitam conexões
 * paralelas do mesmo IP. Sequencial é previsível e estável.
 */
export async function fetchAllWorkspacesEmail(): Promise<FetchStats[]> {
  const credenciais = await db.integrationCredential.findMany({
    where: { channel: 'email_imap_smtp', enabled: true },
    select: { id: true, workspaceId: true },
    take: 500,
  })

  const stats: FetchStats[] = []
  for (const c of credenciais) {
    try {
      const s = await fetchCredentialEmail(c.id)
      stats.push(s)
    } catch (e) {
      stats.push({
        workspaceId: c.workspaceId,
        novasMensagens: 0,
        conversasCriadas: 0,
        conversasAtualizadas: 0,
        ok: false,
        error: e instanceof Error ? e.message : 'erro',
      })
    }
  }
  return stats
}
