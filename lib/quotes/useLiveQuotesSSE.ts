'use client'
import { useEffect, useState } from 'react'
import { useLiveQuotes, type LiveQuotesResponse } from './useLiveQuotes'

export interface SSESnapshot {
  soja: number | null
  milho: number | null
  trigo: number | null
  usdbrl: number | null
  ts: string
}

interface UseLiveQuotesSSEResult {
  data: LiveQuotesResponse | null
  snapshot: SSESnapshot | null
  error: string | null
  loading: boolean
  /** 'sse' | 'polling' — usado pelo UI pra mostrar status do streaming */
  transport: 'sse' | 'polling'
}

/**
 * Hook substituto de useLiveQuotes via Server-Sent Events.
 *
 * - Tenta EventSource em /api/cotacoes/stream (5s/evento, heartbeat 30s).
 * - Para cards detalhados (sparkline/OHLC/changePct) faz 1 fetch /api/cotacoes/live
 *   a cada 60s (snapshot completo). SSE entrega apenas o preço corrente —
 *   barato, real time, zero custo.
 * - Fallback automático pra useLiveQuotes (polling 20s) se EventSource indisponível
 *   ou se a conexão SSE der erro persistente.
 */
export function useLiveQuotesSSE(): UseLiveQuotesSSEResult {
  const supportsSSE = typeof window !== 'undefined' && 'EventSource' in window
  const polling = useLiveQuotes(supportsSSE ? 60_000 : 20_000)

  const [snapshot, setSnapshot] = useState<SSESnapshot | null>(null)
  const [transport, setTransport] = useState<'sse' | 'polling'>(
    supportsSSE ? 'sse' : 'polling',
  )

  useEffect(() => {
    if (!supportsSSE) return
    let es: EventSource | null = null
    let errCount = 0
    try {
      es = new EventSource('/api/cotacoes/stream')
      es.onmessage = (ev) => {
        errCount = 0
        try {
          const snap = JSON.parse(ev.data) as SSESnapshot
          setSnapshot(snap)
        } catch {
          // payload mal-formado — ignora
        }
      }
      es.onerror = () => {
        errCount++
        // 3 erros consecutivos sem sucesso → desiste e cai pro polling
        if (errCount >= 3) {
          es?.close()
          setTransport('polling')
        }
      }
    } catch {
      setTransport('polling')
    }
    return () => { es?.close() }
  }, [supportsSSE])

  return {
    data: polling.data,
    snapshot,
    error: polling.error,
    loading: polling.loading,
    transport,
  }
}
