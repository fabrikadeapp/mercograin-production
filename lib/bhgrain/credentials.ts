/**
 * BH Grain — Service de credenciais de integração por workspace × canal.
 *
 * Multi-conta por (workspaceId, channel, identifier).
 * Para emails:    identifier = imapUser
 * Para Instagram: identifier = pageId
 * Para WhatsApp:  identifier = instanceName
 *
 * - Salva config plain + segredos criptografados (AES-256-GCM, AAD por canal+field).
 * - Retorna config segura (sem expor segredos) para UI.
 * - Decrypt sob demanda para uso interno (webhook handlers, IMAP fetcher etc).
 */

import { db } from '@/lib/db'
import { encryptSecret, decryptSecret, type SecretContext } from './crypto-secret'

export type IntegrationChannel = 'email_imap_smtp' | 'instagram' | 'whatsapp'

export interface EmailConfig {
  imapHost: string
  imapPort: number
  imapUser: string
  imapTls: boolean
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpTls: boolean
  fromName?: string | null
  fromEmail?: string | null
}

export interface InstagramConfig {
  pageId: string
  instagramBusinessId?: string | null
  /** Display name da página (mostrado na UI) */
  pageName?: string | null
}

export interface WhatsappConfig {
  modo: 'central' | 'byo'
  /** Nome da instância no servidor Evolution */
  instanceName: string
  /** URL base do servidor Evolution */
  baseUrl: string
  /** Phone number conectado (preenchido após pareamento) */
  phoneNumber?: string | null
}

export type IntegrationConfig = EmailConfig | InstagramConfig | WhatsappConfig

interface SecretsByChannel {
  email_imap_smtp: { imapPassword?: string; smtpPassword?: string }
  instagram: { pageAccessToken?: string }
  whatsapp: { apiKey?: string }
}

export interface CredentialPublicView<C> {
  id: string
  channel: IntegrationChannel
  provider: string | null
  displayName: string | null
  identifier: string | null
  config: C
  /** Lista de segredos cadastrados (sem o valor) */
  hasSecrets: string[]
  enabled: boolean
  lastTestedAt: string | null
  lastTestSuccess: boolean | null
  lastTestError: string | null
  updatedAt: string
}

interface DbRow {
  id: string
  provider: string | null
  displayName: string | null
  identifier: string | null
  config: unknown
  secretsEncrypted: unknown
  enabled: boolean
  lastTestedAt: Date | null
  lastTestSuccess: boolean | null
  lastTestError: string | null
  updatedAt: Date
}

function publicView<C>(channel: IntegrationChannel, row: DbRow): CredentialPublicView<C> {
  const secretsMap = (row.secretsEncrypted ?? {}) as Record<string, string>
  return {
    id: row.id,
    channel,
    provider: row.provider,
    displayName: row.displayName,
    identifier: row.identifier,
    config: row.config as C,
    hasSecrets: Object.keys(secretsMap),
    enabled: row.enabled,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    lastTestSuccess: row.lastTestSuccess,
    lastTestError: row.lastTestError,
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ============================================================================
// MULTI-CONTA — listagem por canal
// ============================================================================

export async function listEmailCredentials(workspaceId: string): Promise<CredentialPublicView<EmailConfig>[]> {
  const rows = await db.integrationCredential.findMany({
    where: { workspaceId, channel: 'email_imap_smtp' },
    orderBy: [{ enabled: 'desc' }, { createdAt: 'asc' }],
  })
  return rows.map((r) => publicView<EmailConfig>('email_imap_smtp', r))
}

export async function listInstagramCredentials(workspaceId: string): Promise<CredentialPublicView<InstagramConfig>[]> {
  const rows = await db.integrationCredential.findMany({
    where: { workspaceId, channel: 'instagram' },
    orderBy: [{ enabled: 'desc' }, { createdAt: 'asc' }],
  })
  return rows.map((r) => publicView<InstagramConfig>('instagram', r))
}

export async function listWhatsappCredentials(workspaceId: string): Promise<CredentialPublicView<WhatsappConfig>[]> {
  const rows = await db.integrationCredential.findMany({
    where: { workspaceId, channel: 'whatsapp' },
    orderBy: [{ enabled: 'desc' }, { createdAt: 'asc' }],
  })
  return rows.map((r) => publicView<WhatsappConfig>('whatsapp', r))
}

export async function getCredentialById(
  workspaceId: string,
  id: string
): Promise<CredentialPublicView<IntegrationConfig> | null> {
  const row = await db.integrationCredential.findFirst({
    where: { id, workspaceId },
  })
  if (!row) return null
  return publicView<IntegrationConfig>(row.channel as IntegrationChannel, row)
}

// ============================================================================
// LEGACY single-account getters (compat — retornam 1ª credencial habilitada)
// ============================================================================

export async function getEmailCredential(workspaceId: string): Promise<CredentialPublicView<EmailConfig> | null> {
  const rows = await listEmailCredentials(workspaceId)
  return rows[0] ?? null
}

export async function getInstagramCredential(workspaceId: string): Promise<CredentialPublicView<InstagramConfig> | null> {
  const rows = await listInstagramCredentials(workspaceId)
  return rows[0] ?? null
}

export async function getWhatsappCredential(workspaceId: string): Promise<CredentialPublicView<WhatsappConfig> | null> {
  const rows = await listWhatsappCredentials(workspaceId)
  return rows[0] ?? null
}

// ============================================================================
// CRUD multi-conta
// ============================================================================

interface CreateInput<C, S> {
  workspaceId: string
  channel: IntegrationChannel
  provider: string
  displayName: string
  identifier: string
  config: C
  secretsPlain: Partial<Record<keyof S & string, string | null | undefined>>
  enabled?: boolean
  userId?: string
}

function encryptSecretsMap<S>(
  workspaceId: string,
  channel: IntegrationChannel,
  secretsPlain: Partial<Record<keyof S & string, string | null | undefined>>,
  existing: Record<string, string> = {}
): Record<string, string> {
  const out: Record<string, string> = { ...existing }
  const entries = Object.entries(secretsPlain) as [string, string | null | undefined][]
  for (const [field, plain] of entries) {
    if (plain == null || plain === '') continue
    const ctx: SecretContext = { workspaceId, channel, field }
    out[field] = encryptSecret(plain, ctx)
  }
  return out
}

/**
 * Cria nova credencial (multi-conta).
 * Falha com erro Prisma P2002 se já existe (workspaceId, channel, identifier).
 */
export async function createCredential<C, S>(
  input: CreateInput<C, S>
): Promise<CredentialPublicView<C>> {
  const secrets = encryptSecretsMap<S>(
    input.workspaceId,
    input.channel,
    input.secretsPlain
  )
  const row = await db.integrationCredential.create({
    data: {
      workspaceId: input.workspaceId,
      channel: input.channel,
      provider: input.provider,
      displayName: input.displayName,
      identifier: input.identifier,
      config: input.config as unknown as object,
      secretsEncrypted: secrets,
      enabled: input.enabled ?? false,
      createdBy: input.userId,
    },
  })
  return publicView<C>(input.channel, row)
}

interface UpdateInput<C, S> {
  workspaceId: string
  id: string
  channel: IntegrationChannel
  /** Provider/displayName/identifier opcionais — se ausentes, preservam. */
  provider?: string
  displayName?: string
  identifier?: string
  config?: Partial<C>
  /** Map fieldName → string nova. Campos null/undefined preservam segredo existente. */
  secretsPlain?: Partial<Record<keyof S & string, string | null | undefined>>
  enabled?: boolean
}

export async function updateCredential<C, S>(input: UpdateInput<C, S>): Promise<CredentialPublicView<C> | null> {
  const existing = await db.integrationCredential.findFirst({
    where: { id: input.id, workspaceId: input.workspaceId, channel: input.channel },
  })
  if (!existing) return null

  const existingSecrets = (existing.secretsEncrypted ?? {}) as Record<string, string>
  const mergedSecrets = input.secretsPlain
    ? encryptSecretsMap<S>(input.workspaceId, input.channel, input.secretsPlain, existingSecrets)
    : existingSecrets

  const mergedConfig = input.config
    ? { ...(existing.config as object), ...(input.config as object) }
    : existing.config

  const row = await db.integrationCredential.update({
    where: { id: existing.id },
    data: {
      provider: input.provider ?? existing.provider,
      displayName: input.displayName ?? existing.displayName,
      identifier: input.identifier ?? existing.identifier,
      config: mergedConfig as object,
      secretsEncrypted: mergedSecrets,
      enabled: input.enabled ?? existing.enabled,
    },
  })
  return publicView<C>(input.channel, row)
}

export async function deleteCredentialById(workspaceId: string, id: string): Promise<boolean> {
  const r = await db.integrationCredential.deleteMany({
    where: { id, workspaceId },
  })
  return r.count > 0
}

/**
 * Acessa segredo decriptografado para uso interno (NUNCA expor em resposta HTTP).
 * Sobrecarga: aceita ID da credencial OU (workspaceId, channel) legado (1ª credencial).
 */
export async function getSecretById(
  workspaceId: string,
  credentialId: string,
  field: string
): Promise<string | null> {
  const row = await db.integrationCredential.findFirst({
    where: { id: credentialId, workspaceId },
  })
  if (!row) return null
  const secrets = (row.secretsEncrypted ?? {}) as Record<string, string>
  const enc = secrets[field]
  if (!enc) return null
  return decryptSecret(enc, { workspaceId, channel: row.channel, field })
}

/** Legacy: retorna o segredo da PRIMEIRA credencial habilitada do canal. */
export async function getSecret(
  workspaceId: string,
  channel: IntegrationChannel,
  field: string
): Promise<string | null> {
  const row = await db.integrationCredential.findFirst({
    where: { workspaceId, channel },
    orderBy: [{ enabled: 'desc' }, { createdAt: 'asc' }],
  })
  if (!row) return null
  const secrets = (row.secretsEncrypted ?? {}) as Record<string, string>
  const enc = secrets[field]
  if (!enc) return null
  return decryptSecret(enc, { workspaceId, channel, field })
}

export async function recordTestResultById(
  workspaceId: string,
  credentialId: string,
  success: boolean,
  error?: string
): Promise<void> {
  await db.integrationCredential.updateMany({
    where: { id: credentialId, workspaceId },
    data: {
      lastTestedAt: new Date(),
      lastTestSuccess: success,
      lastTestError: success ? null : (error ?? null),
      ...(success ? { enabled: true } : {}),
    },
  })
}

/** Legacy: atualiza a PRIMEIRA credencial do canal. */
export async function recordTestResult(
  workspaceId: string,
  channel: IntegrationChannel,
  success: boolean,
  error?: string
): Promise<void> {
  const row = await db.integrationCredential.findFirst({
    where: { workspaceId, channel },
    orderBy: [{ enabled: 'desc' }, { createdAt: 'asc' }],
  })
  if (!row) return
  await recordTestResultById(workspaceId, row.id, success, error)
}

// ============================================================================
// LEGACY single-account save (compat) — usa create OR update
// ============================================================================

export async function saveEmailCredential(
  workspaceId: string,
  config: EmailConfig,
  secrets: Partial<SecretsByChannel['email_imap_smtp']>,
  opts: { enabled?: boolean; userId?: string; provider?: string; displayName?: string } = {}
): Promise<void> {
  const identifier = config.imapUser
  const existing = await db.integrationCredential.findFirst({
    where: { workspaceId, channel: 'email_imap_smtp', identifier },
  })
  if (existing) {
    await updateCredential<EmailConfig, SecretsByChannel['email_imap_smtp']>({
      workspaceId,
      id: existing.id,
      channel: 'email_imap_smtp',
      config,
      secretsPlain: secrets,
      enabled: opts.enabled,
      provider: opts.provider,
      displayName: opts.displayName,
      identifier,
    })
  } else {
    await createCredential<EmailConfig, SecretsByChannel['email_imap_smtp']>({
      workspaceId,
      channel: 'email_imap_smtp',
      provider: opts.provider ?? 'custom',
      displayName: opts.displayName ?? identifier,
      identifier,
      config,
      secretsPlain: secrets,
      enabled: opts.enabled,
      userId: opts.userId,
    })
  }
}

export async function saveInstagramCredential(
  workspaceId: string,
  config: InstagramConfig,
  secrets: Partial<SecretsByChannel['instagram']>,
  opts: { enabled?: boolean; userId?: string } = {}
): Promise<void> {
  const identifier = config.pageId
  const existing = await db.integrationCredential.findFirst({
    where: { workspaceId, channel: 'instagram', identifier },
  })
  if (existing) {
    await updateCredential<InstagramConfig, SecretsByChannel['instagram']>({
      workspaceId,
      id: existing.id,
      channel: 'instagram',
      config,
      secretsPlain: secrets,
      enabled: opts.enabled,
      identifier,
    })
  } else {
    await createCredential<InstagramConfig, SecretsByChannel['instagram']>({
      workspaceId,
      channel: 'instagram',
      provider: 'meta',
      displayName: config.pageName ?? identifier,
      identifier,
      config,
      secretsPlain: secrets,
      enabled: opts.enabled,
      userId: opts.userId,
    })
  }
}

export async function saveWhatsappCredential(
  workspaceId: string,
  config: WhatsappConfig,
  secrets: Partial<SecretsByChannel['whatsapp']>,
  opts: { enabled?: boolean; userId?: string } = {}
): Promise<void> {
  const identifier = config.instanceName
  const existing = await db.integrationCredential.findFirst({
    where: { workspaceId, channel: 'whatsapp', identifier },
  })
  if (existing) {
    await updateCredential<WhatsappConfig, SecretsByChannel['whatsapp']>({
      workspaceId,
      id: existing.id,
      channel: 'whatsapp',
      config,
      secretsPlain: secrets,
      enabled: opts.enabled,
      identifier,
    })
  } else {
    await createCredential<WhatsappConfig, SecretsByChannel['whatsapp']>({
      workspaceId,
      channel: 'whatsapp',
      provider: config.modo === 'byo' ? 'evolution_byo' : 'evolution_central',
      displayName: config.phoneNumber ?? identifier,
      identifier,
      config,
      secretsPlain: secrets,
      enabled: opts.enabled,
      userId: opts.userId,
    })
  }
}

export async function deleteCredential(
  workspaceId: string,
  channel: IntegrationChannel
): Promise<void> {
  // Legacy: deleta TODAS as credenciais do canal (mantém compat com chamadas antigas).
  await db.integrationCredential
    .deleteMany({ where: { workspaceId, channel } })
    .catch(() => undefined)
}

/**
 * Lista todas as credenciais do workspace, agrupadas por canal (multi-conta).
 * Mantém compat com a UI legada que esperava 1 por canal — retorna `legacy.email/instagram/whatsapp`
 * com a primeira credencial (para forms single-account ainda em transição).
 */
export async function listAllForWorkspace(workspaceId: string): Promise<{
  email: CredentialPublicView<EmailConfig> | null
  instagram: CredentialPublicView<InstagramConfig> | null
  whatsapp: CredentialPublicView<WhatsappConfig> | null
  emails: CredentialPublicView<EmailConfig>[]
  instagrams: CredentialPublicView<InstagramConfig>[]
  whatsapps: CredentialPublicView<WhatsappConfig>[]
}> {
  const [emails, instagrams, whatsapps] = await Promise.all([
    listEmailCredentials(workspaceId),
    listInstagramCredentials(workspaceId),
    listWhatsappCredentials(workspaceId),
  ])
  return {
    email: emails[0] ?? null,
    instagram: instagrams[0] ?? null,
    whatsapp: whatsapps[0] ?? null,
    emails,
    instagrams,
    whatsapps,
  }
}
