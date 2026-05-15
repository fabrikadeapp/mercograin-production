'use server'

/**
 * BH Grain — Server actions multi-conta para e-mail.
 *
 * Substitui as actions saveEmail/testEmail (single-account) por:
 *  - testEmailDraft : valida IMAP+SMTP de credenciais não-salvas
 *  - createEmail    : cria nova credencial (multi-conta)
 *  - updateEmail    : edita credencial existente
 *  - deleteEmail    : remove uma credencial específica
 *  - testEmailSaved : re-testa credencial já salva
 *  - toggleEmail    : ativa/desativa uma credencial
 *
 * Auth: owner/admin do workspace ativo via requireBhGrainScope.
 */

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireBhGrainScope } from '@/lib/bhgrain/scope-permissions'
import {
  createCredential,
  updateCredential,
  deleteCredentialById,
  getCredentialById,
  getSecretById,
  recordTestResultById,
  type EmailConfig,
} from '@/lib/bhgrain/credentials'
import { testImap, testSmtp } from '@/lib/bhgrain/credential-testers'
import {
  EMAIL_PROVIDERS,
  applyProviderDefaults,
  type EmailProviderId,
} from '@/lib/bhgrain/email-providers'

async function requireWorkspaceAdmin() {
  const scope = await requireBhGrainScope()
  if (!scope.isAdmin && !['owner', 'admin'].includes(scope.workspaceRole)) {
    throw new Error('Acesso negado: apenas owner/admin do workspace')
  }
  return scope
}

interface EmailDraft {
  provider: EmailProviderId
  displayName: string
  imapHost: string
  imapPort: number
  imapUser: string
  imapTls: boolean
  imapPassword: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpTls: boolean
  smtpPassword: string
  fromName?: string | null
  fromEmail?: string | null
}

function isProviderId(v: string): v is EmailProviderId {
  return v === 'gmail' || v === 'outlook' || v === 'hotmail' || v === 'custom'
}

function parseDraft(input: unknown): EmailDraft {
  if (!input || typeof input !== 'object') throw new Error('Dados inválidos')
  const o = input as Record<string, unknown>
  const provider = String(o.provider ?? 'custom')
  if (!isProviderId(provider)) throw new Error('Provedor inválido')

  const displayName = String(o.displayName ?? '').trim()
  if (!displayName) throw new Error('Nome de exibição obrigatório')

  // Aplica defaults do provedor (host/port/tls) se campos vierem vazios
  const defaults = applyProviderDefaults(provider)
  const imapHost = String(o.imapHost ?? '').trim() || defaults.imapHost
  const smtpHost = String(o.smtpHost ?? '').trim() || defaults.smtpHost
  const imapUser = String(o.imapUser ?? '').trim()
  const smtpUser = String(o.smtpUser ?? '').trim() || imapUser
  const imapPassword = String(o.imapPassword ?? '')
  const smtpPassword = String(o.smtpPassword ?? '') || imapPassword

  if (!imapHost || !smtpHost) throw new Error('Hosts IMAP e SMTP obrigatórios')
  if (!imapUser) throw new Error('Usuário IMAP obrigatório (geralmente seu e-mail)')

  return {
    provider,
    displayName: displayName.slice(0, 120),
    imapHost,
    imapPort: Number(o.imapPort) || defaults.imapPort,
    imapUser,
    imapTls: o.imapTls !== false,
    imapPassword,
    smtpHost,
    smtpPort: Number(o.smtpPort) || defaults.smtpPort,
    smtpUser,
    smtpTls: o.smtpTls !== false,
    smtpPassword,
    fromName: o.fromName ? String(o.fromName).trim().slice(0, 100) : null,
    fromEmail: o.fromEmail ? String(o.fromEmail).trim().slice(0, 200) : null,
  }
}

export interface TestResultLine {
  ok: boolean
  message: string
  latencyMs: number | null
}

function normalizeTest(r: { ok: boolean; message: string; latencyMs?: number | null }): TestResultLine {
  return { ok: r.ok, message: r.message, latencyMs: r.latencyMs ?? null }
}

/**
 * Testa um draft (não salva). Usado pelo wizard antes do Salvar.
 * Retorna { imap, smtp, ok } para a UI mostrar.
 */
export async function testEmailDraft(input: unknown): Promise<{
  ok: boolean
  imap: TestResultLine
  smtp: TestResultLine
}> {
  await requireWorkspaceAdmin()
  const d = parseDraft(input)
  if (!d.imapPassword) throw new Error('Senha IMAP obrigatória para testar')
  if (!d.smtpPassword) throw new Error('Senha SMTP obrigatória para testar')

  const [imapR, smtpR] = await Promise.all([
    testImap(d.imapHost, d.imapPort, d.imapUser, d.imapPassword, d.imapTls),
    testSmtp(d.smtpHost, d.smtpPort, d.smtpUser, d.smtpPassword, d.smtpTls),
  ])
  const imap = normalizeTest(imapR)
  const smtp = normalizeTest(smtpR)
  return { ok: imap.ok && smtp.ok, imap, smtp }
}

/**
 * Cria nova credencial de e-mail (multi-conta).
 * Falha com erro 'Já existe uma conta com este e-mail neste workspace.' se
 * (workspaceId, channel, identifier=imapUser) já existir.
 */
export async function createEmail(input: unknown): Promise<{ id: string }> {
  const scope = await requireWorkspaceAdmin()
  const d = parseDraft(input)

  try {
    const cred = await createCredential<EmailConfig, { imapPassword: string; smtpPassword: string }>({
      workspaceId: scope.workspaceId,
      channel: 'email_imap_smtp',
      provider: d.provider,
      displayName: d.displayName,
      identifier: d.imapUser,
      config: {
        imapHost: d.imapHost,
        imapPort: d.imapPort,
        imapUser: d.imapUser,
        imapTls: d.imapTls,
        smtpHost: d.smtpHost,
        smtpPort: d.smtpPort,
        smtpUser: d.smtpUser,
        smtpTls: d.smtpTls,
        fromName: d.fromName,
        fromEmail: d.fromEmail,
      },
      secretsPlain: {
        imapPassword: d.imapPassword,
        smtpPassword: d.smtpPassword,
      },
      enabled: true, // já cria habilitada porque o cliente acabou de testar
      userId: scope.userId,
    })

    await db.auditLog.create({
      data: {
        userId: scope.userId,
        acao: 'E-mail conectado',
        entidade: 'IntegrationCredential',
        entidadeId: cred.id,
        workspaceId: scope.workspaceId,
        mudancas: { provider: d.provider, identifier: d.imapUser, displayName: d.displayName },
      },
    })

    revalidatePath('/configuracoes/integracoes')
    return { id: cred.id }
  } catch (err) {
    // Prisma P2002 (unique constraint)
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      throw new Error(`Já existe uma conta ${EMAIL_PROVIDERS[d.provider].label} cadastrada para ${d.imapUser}.`)
    }
    throw err
  }
}

/** Edita credencial existente. Senhas vazias preservam segredos antigos. */
export async function updateEmail(id: string, input: unknown): Promise<void> {
  const scope = await requireWorkspaceAdmin()
  if (!id || typeof id !== 'string') throw new Error('ID inválido')
  const d = parseDraft(input)

  const updated = await updateCredential<EmailConfig, { imapPassword: string; smtpPassword: string }>({
    workspaceId: scope.workspaceId,
    id,
    channel: 'email_imap_smtp',
    provider: d.provider,
    displayName: d.displayName,
    identifier: d.imapUser,
    config: {
      imapHost: d.imapHost,
      imapPort: d.imapPort,
      imapUser: d.imapUser,
      imapTls: d.imapTls,
      smtpHost: d.smtpHost,
      smtpPort: d.smtpPort,
      smtpUser: d.smtpUser,
      smtpTls: d.smtpTls,
      fromName: d.fromName,
      fromEmail: d.fromEmail,
    },
    secretsPlain: {
      // Strings vazias caem como preservar (encryptSecretsMap ignora '')
      imapPassword: d.imapPassword || undefined,
      smtpPassword: d.smtpPassword || undefined,
    },
  })
  if (!updated) throw new Error('Credencial não encontrada')

  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'E-mail atualizado',
      entidade: 'IntegrationCredential',
      entidadeId: id,
      workspaceId: scope.workspaceId,
      mudancas: { provider: d.provider, identifier: d.imapUser, displayName: d.displayName },
    },
  })

  revalidatePath('/configuracoes/integracoes')
}

export async function deleteEmail(id: string): Promise<void> {
  const scope = await requireWorkspaceAdmin()
  if (!id) throw new Error('ID inválido')
  const cred = await getCredentialById(scope.workspaceId, id)
  if (!cred) throw new Error('Credencial não encontrada')
  await deleteCredentialById(scope.workspaceId, id)
  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'E-mail desconectado',
      entidade: 'IntegrationCredential',
      entidadeId: id,
      workspaceId: scope.workspaceId,
      mudancas: { identifier: cred.identifier, displayName: cred.displayName },
    },
  })
  revalidatePath('/configuracoes/integracoes')
}

/** Re-testa credencial já salva. Usa segredos cadastrados. */
export async function testEmailSaved(id: string): Promise<{
  ok: boolean
  imap: TestResultLine
  smtp: TestResultLine
}> {
  const scope = await requireWorkspaceAdmin()
  const cred = await getCredentialById(scope.workspaceId, id)
  if (!cred) throw new Error('Credencial não encontrada')
  const cfg = cred.config as EmailConfig
  const imapPass = await getSecretById(scope.workspaceId, id, 'imapPassword')
  const smtpPass = await getSecretById(scope.workspaceId, id, 'smtpPassword')
  if (!imapPass || !smtpPass) {
    await recordTestResultById(scope.workspaceId, id, false, 'Senhas não cadastradas')
    throw new Error('Senhas IMAP e SMTP não estão cadastradas para esta credencial')
  }

  const [imapR, smtpR] = await Promise.all([
    testImap(cfg.imapHost, cfg.imapPort, cfg.imapUser, imapPass, cfg.imapTls),
    testSmtp(cfg.smtpHost, cfg.smtpPort, cfg.smtpUser, smtpPass, cfg.smtpTls),
  ])
  const imap = normalizeTest(imapR)
  const smtp = normalizeTest(smtpR)
  const ok = imap.ok && smtp.ok
  await recordTestResultById(
    scope.workspaceId,
    id,
    ok,
    ok ? undefined : `IMAP: ${imap.message} · SMTP: ${smtp.message}`
  )
  revalidatePath('/configuracoes/integracoes')
  return { ok, imap, smtp }
}

export async function toggleEmail(id: string, enabled: boolean): Promise<void> {
  const scope = await requireWorkspaceAdmin()
  const updated = await updateCredential<EmailConfig, never>({
    workspaceId: scope.workspaceId,
    id,
    channel: 'email_imap_smtp',
    enabled,
  })
  if (!updated) throw new Error('Credencial não encontrada')
  revalidatePath('/configuracoes/integracoes')
}
