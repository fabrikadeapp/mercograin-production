/**
 * Evolution API v2 client (WhatsApp).
 *
 * Multi-tenant: todas as funções aceitam `instanceName` como parâmetro.
 * Para uso legacy (cron envs etc), use `getDefaultInstance()` que retorna
 * `process.env.EVOLUTION_INSTANCE_NAME` como fallback.
 */

const EVOLUTION_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '')
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || ''
const DEFAULT_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'phb-grain'

export type EvolutionState = 'open' | 'connecting' | 'close' | 'unknown'

export interface EvolutionInstance {
  instanceName: string
  status: EvolutionState
  ownerJid?: string
  profileName?: string
  profilePicUrl?: string
}

export class EvolutionError extends Error {
  status: number
  body?: unknown
  constructor(message: string, status = 500, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
    this.name = 'EvolutionError'
  }
}

function ensureEnv() {
  if (!EVOLUTION_URL || !EVOLUTION_KEY) {
    throw new EvolutionError(
      'EVOLUTION_API_URL/EVOLUTION_API_KEY não configurados',
      500
    )
  }
}

/** Retorna o instanceName default (legacy / single-instance fallback). */
export function getDefaultInstance(): string {
  return DEFAULT_INSTANCE
}

async function evoFetch<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; ok: boolean; data: T | null }> {
  ensureEnv()
  const url = `${EVOLUTION_URL}${path.startsWith('/') ? path : `/${path}`}`
  const headers: Record<string, string> = {
    apikey: EVOLUTION_KEY,
    Accept: 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  }
  if (init.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  let res: Response
  try {
    res = await fetch(url, { ...init, headers, cache: 'no-store' })
  } catch (err) {
    throw new EvolutionError(
      `Falha de rede ao acessar Evolution API: ${
        err instanceof Error ? err.message : String(err)
      }`,
      502
    )
  }

  let data: any = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  return { status: res.status, ok: res.ok, data }
}

function normalizeState(value: unknown): EvolutionState {
  if (value === 'open' || value === 'connecting' || value === 'close') return value
  return 'unknown'
}

function pickInstance(raw: any, fallbackName: string): EvolutionInstance {
  const inst = raw?.instance ?? raw ?? {}
  const state = normalizeState(inst.state ?? inst.status ?? raw?.state)
  return {
    instanceName: inst.instanceName ?? inst.name ?? fallbackName,
    status: state,
    ownerJid: inst.ownerJid ?? inst.owner ?? undefined,
    profileName: inst.profileName ?? inst.profilePicName ?? undefined,
    profilePicUrl: inst.profilePicUrl ?? inst.profilePictureUrl ?? undefined,
  }
}

export interface CreateInstanceOpts {
  webhookSecret?: string
  webhookUrl?: string
  qrcode?: boolean
}

/**
 * Cria a instância no Evolution. Idempotente — tolera 403/409 ("already exists").
 * Lança erro só se for um erro real e não duplicação.
 */
export async function createInstance(
  instanceName: string,
  opts: CreateInstanceOpts = {}
): Promise<EvolutionInstance> {
  const body: Record<string, any> = {
    instanceName,
    qrcode: opts.qrcode ?? true,
    integration: 'WHATSAPP-BAILEYS',
  }
  if (opts.webhookUrl) {
    body.webhook = { url: opts.webhookUrl, byEvents: true }
  }

  const res = await evoFetch<any>(`/instance/create`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (res.ok || res.status === 409 || res.status === 403) {
    return pickInstance(res.data ?? {}, instanceName)
  }

  // Detect "already exists" semânticamente
  const msg = JSON.stringify(res.data || '').toLowerCase()
  if (msg.includes('already') || msg.includes('exists')) {
    return pickInstance(res.data ?? {}, instanceName)
  }

  throw new EvolutionError(
    `Falha ao criar instance "${instanceName}" (status ${res.status})`,
    res.status,
    res.data
  )
}

/**
 * Garante que a instância existe (cria se necessário) e retorna seu estado.
 */
export async function ensureInstance(
  instanceName: string = DEFAULT_INSTANCE,
  opts: CreateInstanceOpts = {}
): Promise<EvolutionInstance> {
  const state = await evoFetch<any>(
    `/instance/connectionState/${encodeURIComponent(instanceName)}`
  )
  if (state.ok && state.data) {
    return pickInstance(state.data, instanceName)
  }

  await createInstance(instanceName, opts)

  const after = await evoFetch<any>(
    `/instance/connectionState/${encodeURIComponent(instanceName)}`
  )
  if (after.ok && after.data) return pickInstance(after.data, instanceName)
  return { instanceName, status: 'connecting' }
}

export async function getConnectionState(
  instanceName: string = DEFAULT_INSTANCE
): Promise<EvolutionInstance> {
  const res = await evoFetch<any>(
    `/instance/connectionState/${encodeURIComponent(instanceName)}`
  )
  if (!res.ok) {
    if (res.status === 404) {
      return { instanceName, status: 'close' }
    }
    throw new EvolutionError(
      `Falha ao obter estado da instance (status ${res.status})`,
      res.status,
      res.data
    )
  }
  return pickInstance(res.data, instanceName)
}

/**
 * Busca dados de perfil enriquecidos (foto, nome, número) — só vale se conectado.
 * Tenta /instance/fetchInstances ?instanceName= … (Evolution v2 retorna ownerJid + profile).
 */
export async function fetchInstanceProfile(
  instanceName: string
): Promise<EvolutionInstance | null> {
  const res = await evoFetch<any>(
    `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`
  )
  if (!res.ok) return null
  const arr = Array.isArray(res.data) ? res.data : res.data ? [res.data] : []
  if (arr.length === 0) return null
  return pickInstance(arr[0], instanceName)
}

export async function getQRCode(
  instanceName: string = DEFAULT_INSTANCE
): Promise<{
  base64: string | null
  pairingCode?: string
  alreadyConnected: boolean
}> {
  const inst = await ensureInstance(instanceName)
  if (inst.status === 'open') {
    return { base64: null, alreadyConnected: true }
  }

  const res = await evoFetch<any>(
    `/instance/connect/${encodeURIComponent(instanceName)}`
  )
  if (!res.ok) {
    throw new EvolutionError(
      `Falha ao obter QR code (status ${res.status})`,
      res.status,
      res.data
    )
  }

  const data = res.data ?? {}
  const base64Raw: string | null =
    data.base64 ?? data.qrcode?.base64 ?? data.qr ?? null
  const base64 = base64Raw
    ? base64Raw.startsWith('data:')
      ? base64Raw
      : `data:image/png;base64,${base64Raw.replace(/^base64,/, '')}`
    : null

  return {
    base64,
    pairingCode: data.pairingCode ?? data.code ?? undefined,
    alreadyConnected: false,
  }
}

export async function logout(
  instanceName: string = DEFAULT_INSTANCE
): Promise<void> {
  const res = await evoFetch<any>(
    `/instance/logout/${encodeURIComponent(instanceName)}`,
    { method: 'DELETE' }
  )
  if (!res.ok && res.status !== 404) {
    throw new EvolutionError(
      `Falha ao desconectar (status ${res.status})`,
      res.status,
      res.data
    )
  }
}

/**
 * Remove a instância do Evolution (delete completo, libera o nome).
 */
export async function deleteInstance(instanceName: string): Promise<void> {
  const res = await evoFetch<any>(
    `/instance/delete/${encodeURIComponent(instanceName)}`,
    { method: 'DELETE' }
  )
  if (!res.ok && res.status !== 404) {
    throw new EvolutionError(
      `Falha ao deletar instance (status ${res.status})`,
      res.status,
      res.data
    )
  }
}

/**
 * Normaliza E.164 brasileiro: strip não-dígitos, prepend 55 se faltar.
 */
export function normalizeNumber(input: string): string {
  let digits = (input || '').replace(/\D/g, '')
  if (!digits) throw new EvolutionError('Número inválido', 400)
  if (digits.length <= 11) {
    digits = `55${digits}`
  }
  if (digits.length < 12 || digits.length > 15) {
    throw new EvolutionError('Número WhatsApp inválido', 400)
  }
  return digits
}

export async function sendText(
  instanceName: string,
  number: string,
  text: string,
  opts: { delay?: number } = {}
): Promise<{ messageId: string }> {
  const normalized = normalizeNumber(number)
  if (!text || !text.trim()) {
    throw new EvolutionError('Mensagem vazia', 400)
  }
  if (text.length > 4096) {
    throw new EvolutionError('Mensagem excede 4096 caracteres', 400)
  }

  const res = await evoFetch<any>(
    `/message/sendText/${encodeURIComponent(instanceName)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        number: normalized,
        text,
        delay: opts.delay ?? 0,
      }),
    }
  )

  if (!res.ok) {
    throw new EvolutionError(
      `Falha ao enviar mensagem (status ${res.status})`,
      res.status,
      res.data
    )
  }

  const messageId =
    res.data?.key?.id ??
    res.data?.messageId ??
    res.data?.id ??
    'unknown'

  return { messageId: String(messageId) }
}

export async function checkNumbers(
  instanceName: string,
  numbers: string[]
): Promise<Array<{ number: string; exists: boolean; jid?: string }>> {
  const normalized = numbers.map((n) => {
    try {
      return normalizeNumber(n)
    } catch {
      return n.replace(/\D/g, '')
    }
  })
  const res = await evoFetch<any>(
    `/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`,
    {
      method: 'POST',
      body: JSON.stringify({ numbers: normalized }),
    }
  )
  if (!res.ok) {
    throw new EvolutionError(
      `Falha ao verificar números (status ${res.status})`,
      res.status,
      res.data
    )
  }
  const list: any[] = Array.isArray(res.data) ? res.data : res.data?.numbers ?? []
  return list.map((row) => ({
    number: row.number ?? row.exists?.number ?? '',
    exists: Boolean(row.exists),
    jid: row.jid ?? undefined,
  }))
}

export const EVOLUTION_INSTANCE = DEFAULT_INSTANCE
