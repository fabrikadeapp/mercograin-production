'use server'

/**
 * BH Grain — Server actions multi-conta para WhatsApp.
 *
 * Usa o Evolution API central provisionado em infrastructure/evolution-api/.
 * O workspace pode também trazer seu próprio servidor (BYO) — nesse caso,
 * URL+apiKey ficam no config/secrets da credencial.
 *
 * Auth: owner/admin do workspace via requireBhGrainScope.
 */

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireBhGrainScope } from '@/lib/bhgrain/scope-permissions'
import {
  createCredential,
  updateCredential,
  deleteCredentialById,
  getCredentialById,
  type WhatsappConfig,
} from '@/lib/bhgrain/credentials'
import {
  isCentralEvolutionEnabled,
  createCentralInstance,
  reconnectCentralInstance,
  getCentralConnectionState,
  fetchCentralInstance,
  deleteCentralInstance,
  buildInstanceName,
  extractPhoneFromJid,
} from '@/lib/whatsapp/evolution-central'

async function requireWorkspaceAdmin() {
  const scope = await requireBhGrainScope()
  if (!scope.isAdmin && !['owner', 'admin'].includes(scope.workspaceRole)) {
    throw new Error('Acesso negado: apenas owner/admin do workspace')
  }
  return scope
}

/**
 * Cria/recria a instância WhatsApp no Evolution central e retorna QR code.
 * Idempotente: chamar múltiplas vezes é seguro (reusa instância existente).
 */
export async function connectWhatsappCentral(displayName: string): Promise<{
  credentialId: string
  instanceName: string
  qrCodeBase64: string | null
  pairingCode: string | null
  status: string
}> {
  const scope = await requireWorkspaceAdmin()
  if (!isCentralEvolutionEnabled()) {
    throw new Error(
      'WhatsApp central ainda não foi provisionado. Veja infrastructure/evolution-api/README.md.'
    )
  }
  const dn = displayName.trim().slice(0, 120) || 'WhatsApp principal'
  const instanceName = buildInstanceName(scope.workspaceId)

  // Cria/conecta no Evolution
  const result = await createCentralInstance({ instanceName })

  // Upsert credencial no banco
  const existing = await db.integrationCredential.findFirst({
    where: { workspaceId: scope.workspaceId, channel: 'whatsapp', identifier: instanceName },
  })

  const config: WhatsappConfig = {
    modo: 'central',
    instanceName,
    baseUrl: process.env.EVOLUTION_CENTRAL_URL ?? '',
    phoneNumber: null,
  }

  let credentialId: string
  if (existing) {
    const updated = await updateCredential<WhatsappConfig, never>({
      workspaceId: scope.workspaceId,
      id: existing.id,
      channel: 'whatsapp',
      provider: 'evolution_central',
      displayName: dn,
      identifier: instanceName,
      config,
    })
    credentialId = updated!.id
  } else {
    const created = await createCredential<WhatsappConfig, never>({
      workspaceId: scope.workspaceId,
      channel: 'whatsapp',
      provider: 'evolution_central',
      displayName: dn,
      identifier: instanceName,
      config,
      secretsPlain: {},
      enabled: false, // só vira true após o QR ser escaneado
      userId: scope.userId,
    })
    credentialId = created.id
  }

  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'WhatsApp: instância criada',
      entidade: 'IntegrationCredential',
      entidadeId: credentialId,
      workspaceId: scope.workspaceId,
      mudancas: { instanceName, displayName: dn },
    },
  })

  revalidatePath('/configuracoes/integracoes')
  return {
    credentialId,
    instanceName,
    qrCodeBase64: result.qrCodeBase64,
    pairingCode: result.pairingCode,
    status: result.instance.status,
  }
}

/**
 * Re-solicita QR code (quando o anterior expira após ~30s).
 * Não modifica o registro local — só pega novo base64 do Evolution.
 */
export async function refreshWhatsappQRCode(credentialId: string): Promise<{
  qrCodeBase64: string | null
  pairingCode: string | null
  status: string
}> {
  const scope = await requireWorkspaceAdmin()
  const cred = await getCredentialById(scope.workspaceId, credentialId)
  if (!cred || cred.channel !== 'whatsapp') throw new Error('Credencial não encontrada')

  const cfg = cred.config as WhatsappConfig
  const result = await reconnectCentralInstance({
    instanceName: cfg.instanceName,
    baseUrl: cfg.modo === 'byo' ? cfg.baseUrl : undefined,
  })
  return {
    qrCodeBase64: result.qrCodeBase64,
    pairingCode: result.pairingCode,
    status: result.instance.status,
  }
}

/**
 * Verifica o estado atual da conexão. Polled pela UI a cada 2s enquanto
 * o modal de QR está aberto. Quando state === 'open', atualiza credencial
 * com enabled=true e phoneNumber (extraído do ownerJid).
 */
export async function checkWhatsappStatus(credentialId: string): Promise<{
  status: string
  phoneNumber: string | null
  enabled: boolean
}> {
  const scope = await requireWorkspaceAdmin()
  const cred = await getCredentialById(scope.workspaceId, credentialId)
  if (!cred || cred.channel !== 'whatsapp') throw new Error('Credencial não encontrada')

  const cfg = cred.config as WhatsappConfig
  const baseUrl = cfg.modo === 'byo' ? cfg.baseUrl : undefined

  const [state, instance] = await Promise.all([
    getCentralConnectionState(cfg.instanceName, baseUrl),
    fetchCentralInstance(cfg.instanceName, baseUrl).catch(() => null),
  ])

  const isOpen = state === 'open'
  const phoneNumber = extractPhoneFromJid(instance?.ownerJid)

  if (isOpen && (!cred.enabled || cfg.phoneNumber !== phoneNumber)) {
    await updateCredential<WhatsappConfig, never>({
      workspaceId: scope.workspaceId,
      id: cred.id,
      channel: 'whatsapp',
      config: { ...cfg, phoneNumber },
      enabled: true,
      displayName: instance?.profileName ?? cred.displayName ?? undefined,
    })
    await db.auditLog.create({
      data: {
        userId: scope.userId,
        acao: 'WhatsApp conectado',
        entidade: 'IntegrationCredential',
        entidadeId: cred.id,
        workspaceId: scope.workspaceId,
        mudancas: { phoneNumber, profileName: instance?.profileName },
      },
    })
    revalidatePath('/configuracoes/integracoes')
  }

  return {
    status: state,
    phoneNumber: phoneNumber ?? cfg.phoneNumber ?? null,
    enabled: isOpen || cred.enabled,
  }
}

export async function disconnectWhatsapp(credentialId: string): Promise<void> {
  const scope = await requireWorkspaceAdmin()
  const cred = await getCredentialById(scope.workspaceId, credentialId)
  if (!cred || cred.channel !== 'whatsapp') throw new Error('Credencial não encontrada')

  const cfg = cred.config as WhatsappConfig
  const baseUrl = cfg.modo === 'byo' ? cfg.baseUrl : undefined

  // Tenta deletar no Evolution (best-effort)
  await deleteCentralInstance(cfg.instanceName, baseUrl).catch((err) => {
    console.warn('[whatsapp] deleteCentralInstance falhou:', err)
  })

  await deleteCredentialById(scope.workspaceId, credentialId)
  await db.auditLog.create({
    data: {
      userId: scope.userId,
      acao: 'WhatsApp desconectado',
      entidade: 'IntegrationCredential',
      entidadeId: credentialId,
      workspaceId: scope.workspaceId,
      mudancas: { instanceName: cfg.instanceName, phoneNumber: cfg.phoneNumber },
    },
  })
  revalidatePath('/configuracoes/integracoes')
}
