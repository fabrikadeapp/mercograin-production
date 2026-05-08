/**
 * Evolution API v2 client (WhatsApp).
 *
 * Replaces the legacy local-baileys implementation. All HTTP traffic targets the
 * Evolution API v2.2.3 instance hosted on Railway. Every call includes the
 * `apikey` header and disables Next.js fetch caching.
 *
 * TODO: Implement webhook receiver at /api/whatsapp/webhook to handle inbound
 * MESSAGES_UPSERT / CONNECTION_UPDATE events when we want to react to incoming
 * messages or connection state changes.
 */

const EVOLUTION_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/+$/, '')
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || ''
const INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'phb-grain'

export type EvolutionState = 'open' | 'connecting' | 'close' | 'unknown'

export interface EvolutionInstance {
  instanceName: string
  status: EvolutionState
  ownerJid?: string
  profileName?: string
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

function pickInstance(raw: any): EvolutionInstance {
  // Connection-state endpoint shape: { instance: { instanceName, state } }
  // Create endpoint shape: { instance: { instanceName, instanceId, status }, ... }
  // FetchInstances list item shape can be: { instance: { ... } } or flat
  const inst = raw?.instance ?? raw ?? {}
  const state = normalizeState(inst.state ?? inst.status ?? raw?.state)
  return {
    instanceName: inst.instanceName ?? inst.name ?? INSTANCE,
    status: state,
    ownerJid: inst.ownerJid ?? inst.owner ?? undefined,
    profileName: inst.profileName ?? inst.profilePicName ?? undefined,
  }
}

/**
 * Ensures the dedicated instance exists. Creates it if missing and returns
 * the current connection state. Tolerates 403/409 ("already exists").
 */
export async function ensureInstance(): Promise<EvolutionInstance> {
  const state = await evoFetch<any>(
    `/instance/connectionState/${encodeURIComponent(INSTANCE)}`
  )
  if (state.ok && state.data) {
    return pickInstance(state.data)
  }

  // Try to create
  const create = await evoFetch<any>(`/instance/create`, {
    method: 'POST',
    body: JSON.stringify({
      instanceName: INSTANCE,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  })

  if (create.ok || create.status === 409 || create.status === 403) {
    // Try state again after create attempt
    const after = await evoFetch<any>(
      `/instance/connectionState/${encodeURIComponent(INSTANCE)}`
    )
    if (after.ok && after.data) return pickInstance(after.data)
    return pickInstance(create.data ?? {})
  }

  throw new EvolutionError(
    `Falha ao garantir instance "${INSTANCE}" (status ${create.status})`,
    create.status,
    create.data
  )
}

export async function getConnectionState(): Promise<EvolutionInstance> {
  const res = await evoFetch<any>(
    `/instance/connectionState/${encodeURIComponent(INSTANCE)}`
  )
  if (!res.ok) {
    if (res.status === 404) {
      return { instanceName: INSTANCE, status: 'close' }
    }
    throw new EvolutionError(
      `Falha ao obter estado da instance (status ${res.status})`,
      res.status,
      res.data
    )
  }
  return pickInstance(res.data)
}

export async function getQRCode(): Promise<{
  base64: string | null
  pairingCode?: string
  alreadyConnected: boolean
}> {
  // Make sure instance exists first.
  const inst = await ensureInstance()
  if (inst.status === 'open') {
    return { base64: null, alreadyConnected: true }
  }

  const res = await evoFetch<any>(
    `/instance/connect/${encodeURIComponent(INSTANCE)}`
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

export async function logout(): Promise<void> {
  const res = await evoFetch<any>(
    `/instance/logout/${encodeURIComponent(INSTANCE)}`,
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
 * Normalizes a Brazilian/E164 phone string: strips non-digits and prepends 55
 * (Brazil DDI) when missing. Validates a minimum sane length.
 */
export function normalizeNumber(input: string): string {
  let digits = (input || '').replace(/\D/g, '')
  if (!digits) throw new EvolutionError('Número inválido', 400)
  if (digits.length <= 11) {
    // assume Brazil — prepend 55 if absent
    digits = `55${digits}`
  }
  if (digits.length < 12 || digits.length > 15) {
    throw new EvolutionError('Número WhatsApp inválido', 400)
  }
  return digits
}

export async function sendText(
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
    `/message/sendText/${encodeURIComponent(INSTANCE)}`,
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
    `/chat/whatsappNumbers/${encodeURIComponent(INSTANCE)}`,
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

export const EVOLUTION_INSTANCE = INSTANCE
