/**
 * S10 M2 — SSE realtime de cotações.
 *
 * GET /api/cotacoes/stream
 *   text/event-stream  — emite payload {soja, milho, trigo, usdbrl, ts} a cada
 *                        5s. Heartbeat (comentário `:ping`) a cada 30s pra
 *                        atravessar proxies (Vercel, Cloudflare) sem fechar.
 *
 * Auth: precisa de sessão válida (multi-tenant — qualquer membro autenticado).
 * Backend reaproveita o `/api/cotacoes/live` (cache em memória já garante zero
 * custo upstream — múltiplos clientes não multiplicam chamadas).
 *
 * POST: idêntico ao GET (alguns clientes/proxies fazem POST). Apenas auth.
 */
import { auth } from '@/auth'
import { db as prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const fetchCache = 'force-no-store'

const TICK_MS = 5_000
const HEARTBEAT_MS = 30_000

async function fetchSnapshot(origin: string) {
  // Chamada interna usa o próprio handler /api/cotacoes/live (cache 30s-5min).
  try {
    const res = await fetch(`${origin}/api/cotacoes/live`, { cache: 'no-store' })
    if (!res.ok) return null
    const j = await res.json()
    return {
      soja:   j.soja?.price ?? null,
      milho:  j.milho?.price ?? null,
      trigo:  j.trigo?.price ?? null,
      usdbrl: j.usdbrl?.price ?? null,
      ts:     j.fetchedAt || new Date().toISOString(),
    }
  } catch {
    return null
  }
}

async function handle(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('unauthorized', { status: 401 })
  }
  // Multi-tenant: confirma que user tem workspace ativo
  const member = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id, status: 'active' },
    select: { workspaceId: true },
  }).catch(() => null)
  if (!member) {
    return new Response('forbidden', { status: 403 })
  }

  const url = new URL(req.url)
  const origin = `${url.protocol}//${url.host}`

  const encoder = new TextEncoder()
  let tickTimer: ReturnType<typeof setInterval> | null = null
  let beatTimer: ReturnType<typeof setInterval> | null = null
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function safeEnqueue(chunk: string) {
        if (closed) return
        try { controller.enqueue(encoder.encode(chunk)) } catch { closed = true }
      }
      async function emit() {
        const snap = await fetchSnapshot(origin)
        if (snap) safeEnqueue(`data: ${JSON.stringify(snap)}\n\n`)
      }
      // Saída inicial imediata
      safeEnqueue(`retry: 5000\n\n`)
      await emit()

      tickTimer = setInterval(() => { void emit() }, TICK_MS)
      beatTimer = setInterval(() => { safeEnqueue(`:ping\n\n`) }, HEARTBEAT_MS)

      // Aborto do cliente fecha tudo
      const onAbort = () => {
        closed = true
        if (tickTimer) clearInterval(tickTimer)
        if (beatTimer) clearInterval(beatTimer)
        try { controller.close() } catch {}
      }
      req.signal.addEventListener('abort', onAbort)
    },
    cancel() {
      closed = true
      if (tickTimer) clearInterval(tickTimer)
      if (beatTimer) clearInterval(beatTimer)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export const GET = handle
export const POST = handle
