/**
 * BH Grain — Cliente do Evolution API CENTRAL (compartilhado entre workspaces).
 *
 * Arquitetura:
 *  - 1 servidor Evolution único hospedado pela Mercograin
 *  - N instâncias dentro dele, 1 por (workspace × telefone do cliente)
 *  - Cada instância tem nome `bhg-<workspaceId>-<random>`
 *  - Webhook global aponta para /api/whatsapp/webhook/evolution
 *
 * Envs (Railway, serviço web):
 *   EVOLUTION_CENTRAL_URL   = https://evolution-api-production-xxxx.up.railway.app
 *   EVOLUTION_CENTRAL_API_KEY = <mesma key configurada no servidor Evolution>
 *
 * Para workspaces que preferem trazer o próprio servidor (BYO), o cliente
 * armazena URL+apiKey na IntegrationCredential.config / secretsEncrypted
 * e o resolver escolhe qual usar.
 */

import { EvolutionError, type EvolutionInstance, type EvolutionState } from './evolution'

const CENTRAL_URL = (process.env.EVOLUTION_CENTRAL_URL ?? '').replace(/\/+$/, '')
const CENTRAL_KEY = process.env.EVOLUTION_CENTRAL_API_KEY ?? ''

/** True quando o servidor Evolution central está configurado e pronto pra uso. */
export function isCentralEvolutionEnabled(): boolean {
  return CENTRAL_URL.length > 0 && CENTRAL_KEY.length > 0
}

interface EvoFetchInit extends RequestInit {
  url?: string
  apiKey?: string
}

async function evoFetchCentral<T = unknown>(
  path: string,
  init: EvoFetchInit = {}
): Promise<{ status: number; ok: boolean; data: T | null }> {
  const baseUrl = init.url ?? CENTRAL_URL
  const apiKey = init.apiKey ?? CENTRAL_KEY
  if (!baseUrl || !apiKey) {
    throw new EvolutionError(
      'EVOLUTION_CENTRAL_URL/EVOLUTION_CENTRAL_API_KEY não configurados. ' +
        'Veja infrastructure/evolution-api/README.md para provisionar.',
      500
    )
  }
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const headers: Record<string, string> = {
    apikey: apiKey,
    Accept: 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(url, { ...init, headers, cache: 'no-store' })
  } catch (err) {
    throw new EvolutionError(
      `Falha de rede ao acessar Evolution central: ${err instanceof Error ? err.message : String(err)}`,
      502
    )
  }

  let data: T | null = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text) as T
    } catch {
      data = text as unknown as T
    }
  }
  return { status: res.status, ok: res.ok, data }
}

function normalizeState(v: unknown): EvolutionState {
  if (v === 'open' || v === 'connecting' || v === 'close') return v
  return 'unknown'
}

// ============================================================================
// API pública — operações por instância
// ============================================================================

export interface CreateInstanceCentralOpts {
  /** Nome único da instância. Use buildInstanceName() abaixo. */
  instanceName: string
  /** URL+key opcionais (BYO override do central). */
  baseUrl?: string
  apiKey?: string
}

interface CreateInstanceResponse {
  instance?: { instanceName?: string; status?: string }
  hash?: { apikey?: string }
  qrcode?: { base64?: string; pairingCode?: string; code?: string; count?: number }
}

/**
 * Cria a instância e devolve QR code base64 + estado inicial.
 * Idempotente — se já existe, retorna estado atual (sem QR novo).
 *
 * Webhook NÃO é configurado por instância porque usamos o WEBHOOK_GLOBAL_URL
 * do servidor (definido nas envs do Evolution). Isso garante que mesmo
 * instâncias criadas fora deste app (debug, manual via curl) chegam aqui.
 */
export async function createCentralInstance(
  opts: CreateInstanceCentralOpts
): Promise<{
  instance: EvolutionInstance
  qrCodeBase64: string | null
  pairingCode: string | null
}> {
  const body = {
    instanceName: opts.instanceName,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
  }
  const res = await evoFetchCentral<CreateInstanceResponse>('/instance/create', {
    method: 'POST',
    body: JSON.stringify(body),
    url: opts.baseUrl,
    apiKey: opts.apiKey,
  })

  // Já existe — buscar QR atual via /instance/connect
  if (!res.ok && (res.status === 403 || res.status === 409 ||
    String(res.data ?? '').toLowerCase().includes('already'))) {
    return reconnectCentralInstance(opts)
  }
  if (!res.ok) {
    throw new EvolutionError(
      `Falha ao criar instance "${opts.instanceName}" (HTTP ${res.status})`,
      res.status,
      res.data
    )
  }
  const data = res.data ?? {}
  return {
    instance: {
      instanceName: data.instance?.instanceName ?? opts.instanceName,
      status: normalizeState(data.instance?.status),
    },
    qrCodeBase64: data.qrcode?.base64 ?? null,
    pairingCode: data.qrcode?.pairingCode ?? null,
  }
}

interface ConnectResponse {
  base64?: string
  pairingCode?: string
  code?: string
  qrcode?: { base64?: string; pairingCode?: string }
}

/**
 * Solicita reconexão (re-emite QR code) para uma instância existente.
 * Usado quando o cliente reabre o modal e o QR anterior expirou.
 */
export async function reconnectCentralInstance(
  opts: CreateInstanceCentralOpts
): Promise<{
  instance: EvolutionInstance
  qrCodeBase64: string | null
  pairingCode: string | null
}> {
  const res = await evoFetchCentral<ConnectResponse>(
    `/instance/connect/${encodeURIComponent(opts.instanceName)}`,
    { method: 'GET', url: opts.baseUrl, apiKey: opts.apiKey }
  )
  if (!res.ok) {
    throw new EvolutionError(
      `Falha ao reconectar instance "${opts.instanceName}" (HTTP ${res.status})`,
      res.status,
      res.data
    )
  }
  const data = res.data ?? {}
  const base64 = data.base64 ?? data.qrcode?.base64 ?? null
  const pairingCode = data.pairingCode ?? data.qrcode?.pairingCode ?? null
  return {
    instance: { instanceName: opts.instanceName, status: base64 ? 'connecting' : 'unknown' },
    qrCodeBase64: base64,
    pairingCode,
  }
}

interface ConnectionStateResponse {
  instance?: { state?: string; status?: string }
  state?: string
  status?: string
}

export async function getCentralConnectionState(
  instanceName: string,
  baseUrl?: string,
  apiKey?: string
): Promise<EvolutionState> {
  const res = await evoFetchCentral<ConnectionStateResponse>(
    `/instance/connectionState/${encodeURIComponent(instanceName)}`,
    { method: 'GET', url: baseUrl, apiKey }
  )
  if (!res.ok) return 'unknown'
  const data = res.data ?? {}
  return normalizeState(data.instance?.state ?? data.state ?? data.instance?.status ?? data.status)
}

interface FetchInstanceResponse {
  instance?: {
    instanceName?: string
    state?: string
    status?: string
    profileName?: string
    profilePicUrl?: string
    owner?: string
    ownerJid?: string
  }
}

export async function fetchCentralInstance(
  instanceName: string,
  baseUrl?: string,
  apiKey?: string
): Promise<EvolutionInstance | null> {
  const res = await evoFetchCentral<FetchInstanceResponse[] | FetchInstanceResponse>(
    `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
    { method: 'GET', url: baseUrl, apiKey }
  )
  if (!res.ok || !res.data) return null
  const arr = Array.isArray(res.data) ? res.data : [res.data]
  const found = arr.find((r) => r.instance?.instanceName === instanceName) ?? arr[0]
  if (!found?.instance) return null
  const inst = found.instance
  return {
    instanceName: inst.instanceName ?? instanceName,
    status: normalizeState(inst.state ?? inst.status),
    profileName: inst.profileName,
    profilePicUrl: inst.profilePicUrl,
    ownerJid: inst.ownerJid ?? inst.owner,
  }
}

export async function deleteCentralInstance(
  instanceName: string,
  baseUrl?: string,
  apiKey?: string
): Promise<void> {
  // Logout primeiro (best-effort) — depois delete
  await evoFetchCentral(`/instance/logout/${encodeURIComponent(instanceName)}`, {
    method: 'DELETE',
    url: baseUrl,
    apiKey,
  }).catch(() => undefined)
  await evoFetchCentral(`/instance/delete/${encodeURIComponent(instanceName)}`, {
    method: 'DELETE',
    url: baseUrl,
    apiKey,
  })
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Gera um nome de instância determinístico para o workspace.
 * Formato: `bhg-<workspaceId>` (limitado a 60 chars). Determinístico permite
 * recriar a mesma instância se o registro local for perdido.
 */
export function buildInstanceName(workspaceId: string): string {
  // workspaceId é cuid (~25 chars) → cabe em VARCHAR(60)
  const slug = workspaceId.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 50)
  return `bhg-${slug}`
}

export function extractPhoneFromJid(jid: string | null | undefined): string | null {
  if (!jid) return null
  // Formatos: '5511999998888@s.whatsapp.net' ou '5511999998888:1@s.whatsapp.net'
  const m = jid.match(/^(\d+)/)
  return m ? m[1] : null
}
