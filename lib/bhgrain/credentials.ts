/**
 * BH Grain — Service de credenciais de integração por workspace × canal.
 *
 * - Salva config plain + segredos criptografados.
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
  /** Nome da instância no servidor Evolution (auto-provisioned ou fornecido pelo cliente) */
  instanceName: string
  /** URL base do servidor Evolution (no modo central, é o do SaaS; no BYO, do cliente) */
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
  channel: IntegrationChannel
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
    channel,
    config: row.config as C,
    hasSecrets: Object.keys(secretsMap),
    enabled: row.enabled,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    lastTestSuccess: row.lastTestSuccess,
    lastTestError: row.lastTestError,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getEmailCredential(workspaceId: string): Promise<CredentialPublicView<EmailConfig> | null> {
  const row = await db.integrationCredential.findUnique({
    where: { workspaceId_channel: { workspaceId, channel: 'email_imap_smtp' } },
  })
  return row ? publicView<EmailConfig>('email_imap_smtp', row) : null
}

export async function getInstagramCredential(workspaceId: string): Promise<CredentialPublicView<InstagramConfig> | null> {
  const row = await db.integrationCredential.findUnique({
    where: { workspaceId_channel: { workspaceId, channel: 'instagram' } },
  })
  return row ? publicView<InstagramConfig>('instagram', row) : null
}

export async function getWhatsappCredential(workspaceId: string): Promise<CredentialPublicView<WhatsappConfig> | null> {
  const row = await db.integrationCredential.findUnique({
    where: { workspaceId_channel: { workspaceId, channel: 'whatsapp' } },
  })
  return row ? publicView<WhatsappConfig>('whatsapp', row) : null
}

interface UpsertInput<C, S> {
  workspaceId: string
  channel: IntegrationChannel
  config: C
  /** Map fieldName → plain string. Apenas campos presentes são criptografados.
   *  Campos null/undefined preservam o segredo existente. */
  secretsPlain: Partial<Record<keyof S & string, string | null | undefined>>
  enabled?: boolean
  userId?: string
}

async function upsert<C, S>(input: UpsertInput<C, S>): Promise<void> {
  // Carrega existente para preservar segredos não mudados
  const existing = await db.integrationCredential.findUnique({
    where: { workspaceId_channel: { workspaceId: input.workspaceId, channel: input.channel } },
  })
  const existingSecrets = (existing?.secretsEncrypted ?? {}) as Record<string, string>
  const newSecrets: Record<string, string> = { ...existingSecrets }

  const entries = Object.entries(input.secretsPlain) as [string, string | null | undefined][]
  for (const [field, plain] of entries) {
    if (plain == null || plain === '') continue // null = preserva existente
    const ctx: SecretContext = {
      workspaceId: input.workspaceId,
      channel: input.channel,
      field,
    }
    newSecrets[field] = encryptSecret(plain, ctx)
  }

  if (existing) {
    await db.integrationCredential.update({
      where: { id: existing.id },
      data: {
        config: input.config as unknown as object,
        secretsEncrypted: newSecrets,
        enabled: input.enabled ?? existing.enabled,
      },
    })
  } else {
    await db.integrationCredential.create({
      data: {
        workspaceId: input.workspaceId,
        channel: input.channel,
        config: input.config as unknown as object,
        secretsEncrypted: newSecrets,
        enabled: input.enabled ?? false,
        createdBy: input.userId,
      },
    })
  }
}

export async function saveEmailCredential(
  workspaceId: string,
  config: EmailConfig,
  secrets: Partial<SecretsByChannel['email_imap_smtp']>,
  opts: { enabled?: boolean; userId?: string } = {}
): Promise<void> {
  await upsert<EmailConfig, SecretsByChannel['email_imap_smtp']>({
    workspaceId,
    channel: 'email_imap_smtp',
    config,
    secretsPlain: secrets,
    enabled: opts.enabled,
    userId: opts.userId,
  })
}

export async function saveInstagramCredential(
  workspaceId: string,
  config: InstagramConfig,
  secrets: Partial<SecretsByChannel['instagram']>,
  opts: { enabled?: boolean; userId?: string } = {}
): Promise<void> {
  await upsert<InstagramConfig, SecretsByChannel['instagram']>({
    workspaceId,
    channel: 'instagram',
    config,
    secretsPlain: secrets,
    enabled: opts.enabled,
    userId: opts.userId,
  })
}

export async function saveWhatsappCredential(
  workspaceId: string,
  config: WhatsappConfig,
  secrets: Partial<SecretsByChannel['whatsapp']>,
  opts: { enabled?: boolean; userId?: string } = {}
): Promise<void> {
  await upsert<WhatsappConfig, SecretsByChannel['whatsapp']>({
    workspaceId,
    channel: 'whatsapp',
    config,
    secretsPlain: secrets,
    enabled: opts.enabled,
    userId: opts.userId,
  })
}

/**
 * Acessa segredo decriptografado para uso interno (NUNCA expor em resposta HTTP).
 * Retorna null se não houver segredo cadastrado para o campo.
 */
export async function getSecret(
  workspaceId: string,
  channel: IntegrationChannel,
  field: string
): Promise<string | null> {
  const row = await db.integrationCredential.findUnique({
    where: { workspaceId_channel: { workspaceId, channel } },
  })
  if (!row) return null
  const secrets = (row.secretsEncrypted ?? {}) as Record<string, string>
  const enc = secrets[field]
  if (!enc) return null
  return decryptSecret(enc, { workspaceId, channel, field })
}

export async function recordTestResult(
  workspaceId: string,
  channel: IntegrationChannel,
  success: boolean,
  error?: string
): Promise<void> {
  await db.integrationCredential.update({
    where: { workspaceId_channel: { workspaceId, channel } },
    data: {
      lastTestedAt: new Date(),
      lastTestSuccess: success,
      lastTestError: success ? null : (error ?? null),
      enabled: success ? true : undefined,
    },
  })
}

export async function deleteCredential(
  workspaceId: string,
  channel: IntegrationChannel
): Promise<void> {
  await db.integrationCredential
    .delete({ where: { workspaceId_channel: { workspaceId, channel } } })
    .catch(() => undefined)
}

export async function listAllForWorkspace(workspaceId: string): Promise<{
  email: CredentialPublicView<EmailConfig> | null
  instagram: CredentialPublicView<InstagramConfig> | null
  whatsapp: CredentialPublicView<WhatsappConfig> | null
}> {
  const [email, instagram, whatsapp] = await Promise.all([
    getEmailCredential(workspaceId),
    getInstagramCredential(workspaceId),
    getWhatsappCredential(workspaceId),
  ])
  return { email, instagram, whatsapp }
}
