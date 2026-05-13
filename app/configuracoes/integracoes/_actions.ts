'use server'

/**
 * Server actions para configurar credenciais de integração BH Grain.
 * Auth: owner/admin do workspace ativo via requireBhGrainScope.
 */

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireBhGrainScope } from '@/lib/bhgrain/scope-permissions'
import {
  saveEmailCredential,
  saveInstagramCredential,
  saveWhatsappCredential,
  deleteCredential,
  recordTestResult,
  getSecret,
  type WhatsappConfig,
} from '@/lib/bhgrain/credentials'
import {
  testImap,
  testSmtp,
  testInstagram,
  testWhatsapp,
} from '@/lib/bhgrain/credential-testers'

async function requireWorkspaceAdmin() {
  const scope = await requireBhGrainScope()
  if (!scope.isAdmin && !['owner', 'admin'].includes(scope.workspaceRole)) {
    throw new Error('Acesso negado: apenas owner/admin do workspace')
  }
  return scope
}

function s(fd: FormData, k: string, max = 500): string {
  return String(fd.get(k) ?? '').trim().slice(0, max)
}
function sOpt(fd: FormData, k: string, max = 500): string | undefined {
  const v = String(fd.get(k) ?? '').trim()
  return v ? v.slice(0, max) : undefined
}
function num(fd: FormData, k: string): number | null {
  const v = String(fd.get(k) ?? '').trim()
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function bool(fd: FormData, k: string): boolean {
  return fd.get(k) !== null
}

// ============================================================================
// EMAIL
// ============================================================================

export async function saveEmail(fd: FormData): Promise<void> {
  const scope = await requireWorkspaceAdmin()

  const imapHost = s(fd, 'imapHost', 200)
  const imapPort = num(fd, 'imapPort') ?? 993
  const imapUser = s(fd, 'imapUser', 200)
  const imapTls = bool(fd, 'imapTls')
  const smtpHost = s(fd, 'smtpHost', 200)
  const smtpPort = num(fd, 'smtpPort') ?? 587
  const smtpUser = s(fd, 'smtpUser', 200)
  const smtpTls = bool(fd, 'smtpTls')

  if (!imapHost || !smtpHost || !imapUser || !smtpUser) {
    throw new Error('Host e usuário (IMAP e SMTP) obrigatórios')
  }

  await saveEmailCredential(
    scope.workspaceId,
    {
      imapHost,
      imapPort,
      imapUser,
      imapTls,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpTls,
      fromName: sOpt(fd, 'fromName', 100) ?? null,
      fromEmail: sOpt(fd, 'fromEmail', 200) ?? null,
    },
    {
      imapPassword: sOpt(fd, 'imapPassword'),
      smtpPassword: sOpt(fd, 'smtpPassword'),
    },
    { userId: scope.userId }
  )

  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'Credenciais de e-mail salvas',
      entidade: 'IntegrationCredential',
      entidadeId: `${scope.workspaceId}:email_imap_smtp`,
      workspaceId: scope.workspaceId,
      mudancas: { imapHost, smtpHost, imapUser, smtpUser },
    },
  })
  revalidatePath('/configuracoes/integracoes')
}

export async function testEmail(fd: FormData): Promise<void> {
  const scope = await requireWorkspaceAdmin()
  const cred = await db.integrationCredential.findUnique({
    where: { workspaceId_channel: { workspaceId: scope.workspaceId, channel: 'email_imap_smtp' } },
  })
  if (!cred) throw new Error('Configure as credenciais antes de testar')
  const cfg = cred.config as {
    imapHost: string
    imapPort: number
    imapUser: string
    imapTls: boolean
    smtpHost: string
    smtpPort: number
    smtpUser: string
    smtpTls: boolean
  }
  const imapPass = await getSecret(scope.workspaceId, 'email_imap_smtp', 'imapPassword')
  const smtpPass = await getSecret(scope.workspaceId, 'email_imap_smtp', 'smtpPassword')
  if (!imapPass || !smtpPass) {
    await recordTestResult(scope.workspaceId, 'email_imap_smtp', false, 'Senhas IMAP/SMTP não cadastradas')
    throw new Error('Senhas IMAP e SMTP obrigatórias para testar')
  }

  const [imapRes, smtpRes] = await Promise.all([
    testImap(cfg.imapHost, cfg.imapPort, cfg.imapUser, imapPass, cfg.imapTls),
    testSmtp(cfg.smtpHost, cfg.smtpPort, cfg.smtpUser, smtpPass, cfg.smtpTls),
  ])

  const ok = imapRes.ok && smtpRes.ok
  const msg = ok
    ? `OK · IMAP ${imapRes.latencyMs ?? 0}ms · SMTP ${smtpRes.latencyMs ?? 0}ms`
    : `IMAP: ${imapRes.message} · SMTP: ${smtpRes.message}`
  await recordTestResult(scope.workspaceId, 'email_imap_smtp', ok, ok ? undefined : msg)
  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: ok ? 'Teste de e-mail OK' : 'Teste de e-mail FALHOU',
      entidade: 'IntegrationCredential',
      entidadeId: `${scope.workspaceId}:email_imap_smtp`,
      workspaceId: scope.workspaceId,
      mudancas: { ok, imap: imapRes.message, smtp: smtpRes.message },
    },
  })
  revalidatePath('/configuracoes/integracoes')
}

// ============================================================================
// INSTAGRAM
// ============================================================================

export async function saveInstagram(fd: FormData): Promise<void> {
  const scope = await requireWorkspaceAdmin()
  const pageId = s(fd, 'pageId', 60)
  if (!pageId) throw new Error('Page ID obrigatório')
  const instagramBusinessId = sOpt(fd, 'instagramBusinessId', 60) ?? null
  const pageName = sOpt(fd, 'pageName', 120) ?? null
  const pageAccessToken = sOpt(fd, 'pageAccessToken', 2000)

  await saveInstagramCredential(
    scope.workspaceId,
    { pageId, instagramBusinessId, pageName },
    { pageAccessToken },
    { userId: scope.userId }
  )

  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'Credenciais Instagram salvas',
      entidade: 'IntegrationCredential',
      entidadeId: `${scope.workspaceId}:instagram`,
      workspaceId: scope.workspaceId,
      mudancas: { pageId, hasToken: !!pageAccessToken },
    },
  })
  revalidatePath('/configuracoes/integracoes')
}

export async function testInstagramAction(): Promise<void> {
  const scope = await requireWorkspaceAdmin()
  const token = await getSecret(scope.workspaceId, 'instagram', 'pageAccessToken')
  if (!token) {
    await recordTestResult(scope.workspaceId, 'instagram', false, 'Page Access Token não cadastrado')
    throw new Error('Cadastre o Page Access Token antes de testar')
  }
  const r = await testInstagram(token)
  await recordTestResult(scope.workspaceId, 'instagram', r.ok, r.ok ? undefined : r.message)
  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: r.ok ? 'Teste Instagram OK' : 'Teste Instagram FALHOU',
      entidade: 'IntegrationCredential',
      entidadeId: `${scope.workspaceId}:instagram`,
      workspaceId: scope.workspaceId,
      mudancas: { ok: r.ok, message: r.message },
    },
  })
  revalidatePath('/configuracoes/integracoes')
}

// ============================================================================
// WHATSAPP
// ============================================================================

export async function saveWhatsapp(fd: FormData): Promise<void> {
  const scope = await requireWorkspaceAdmin()

  // O modo é determinado por SystemConfig 'bhgrain.whatsapp.mode' (central|byo|hybrid)
  // Em modo 'central', o owner do workspace NÃO escolhe baseUrl — usa o central.
  // Em 'byo', exige baseUrl+apiKey do cliente.
  // Em 'hybrid', cliente escolhe.
  const modeRow = await db.systemConfig.findUnique({ where: { key: 'bhgrain.whatsapp.mode' } })
  const globalMode = ((modeRow?.value as { mode?: string } | null)?.mode ?? 'hybrid').toLowerCase()
  const centralBaseUrl = (modeRow?.value as { centralBaseUrl?: string } | null)?.centralBaseUrl ?? null
  const centralApiKey = (modeRow?.value as { centralApiKey?: string } | null)?.centralApiKey ?? null

  let modo: WhatsappConfig['modo'] = 'central'
  if (globalMode === 'byo') modo = 'byo'
  else if (globalMode === 'hybrid') {
    const escolhido = s(fd, 'modo', 10)
    modo = escolhido === 'byo' ? 'byo' : 'central'
  } else {
    modo = 'central'
  }

  let baseUrl: string
  let apiKeyPlain: string | undefined
  let instanceName = s(fd, 'instanceName', 100)

  if (modo === 'central') {
    if (!centralBaseUrl) throw new Error('Modo central não configurado pelo super-admin (bhgrain.whatsapp.mode)')
    baseUrl = centralBaseUrl
    apiKeyPlain = centralApiKey ?? undefined
    if (!instanceName) {
      // Auto-provision: usa workspaceId como instanceName por padrão (escapado)
      instanceName = `ws-${scope.workspaceId.slice(0, 20)}`
    }
  } else {
    // BYO
    baseUrl = s(fd, 'baseUrl', 300)
    if (!baseUrl) throw new Error('URL do Evolution obrigatória no modo BYO')
    if (!instanceName) throw new Error('Nome da instância obrigatório')
    apiKeyPlain = sOpt(fd, 'apiKey', 500)
  }

  await saveWhatsappCredential(
    scope.workspaceId,
    {
      modo,
      instanceName,
      baseUrl,
      phoneNumber: sOpt(fd, 'phoneNumber', 30) ?? null,
    },
    { apiKey: apiKeyPlain },
    { userId: scope.userId }
  )

  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'Credenciais WhatsApp salvas',
      entidade: 'IntegrationCredential',
      entidadeId: `${scope.workspaceId}:whatsapp`,
      workspaceId: scope.workspaceId,
      mudancas: { modo, instanceName, baseUrl: baseUrl.slice(0, 60) },
    },
  })
  revalidatePath('/configuracoes/integracoes')
}

export async function testWhatsappAction(): Promise<void> {
  const scope = await requireWorkspaceAdmin()
  const cred = await db.integrationCredential.findUnique({
    where: { workspaceId_channel: { workspaceId: scope.workspaceId, channel: 'whatsapp' } },
  })
  if (!cred) throw new Error('Configure WhatsApp antes de testar')
  const cfg = cred.config as unknown as WhatsappConfig
  const apiKey = await getSecret(scope.workspaceId, 'whatsapp', 'apiKey')
  if (!apiKey) {
    await recordTestResult(scope.workspaceId, 'whatsapp', false, 'apiKey não cadastrada')
    throw new Error('apiKey do Evolution obrigatória')
  }
  const r = await testWhatsapp(cfg.baseUrl, cfg.instanceName, apiKey)
  await recordTestResult(scope.workspaceId, 'whatsapp', r.ok, r.ok ? undefined : r.message)
  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: r.ok ? 'Teste WhatsApp OK' : 'Teste WhatsApp FALHOU',
      entidade: 'IntegrationCredential',
      entidadeId: `${scope.workspaceId}:whatsapp`,
      workspaceId: scope.workspaceId,
      mudancas: { ok: r.ok, message: r.message },
    },
  })
  revalidatePath('/configuracoes/integracoes')
}

export async function deleteChannel(fd: FormData): Promise<void> {
  const scope = await requireWorkspaceAdmin()
  const channel = s(fd, 'channel', 30) as 'email_imap_smtp' | 'instagram' | 'whatsapp'
  if (!['email_imap_smtp', 'instagram', 'whatsapp'].includes(channel)) throw new Error('Canal inválido')
  await deleteCredential(scope.workspaceId, channel)
  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'Credenciais removidas',
      entidade: 'IntegrationCredential',
      entidadeId: `${scope.workspaceId}:${channel}`,
      workspaceId: scope.workspaceId,
      mudancas: { channel },
    },
  })
  revalidatePath('/configuracoes/integracoes')
}
