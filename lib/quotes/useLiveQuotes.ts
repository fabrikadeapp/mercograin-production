'use client'
import { useEffect, useState } from 'react'

export interface LiveQuotePayload {
  symbol: string
  label: 'soja' | 'milho' | 'trigo' | 'usdbrl'
  price: number | null
  open: number | null
  high: number | null
  low: number | null
  previousClose: number | null
  changeAbs: number | null
  changePct: number | null
  currency: string
  exchangeName: string | null
  marketState: string | null
  fetchedAt: string
  sparkline: number[]
}

export interface LiveQuotesResponse {
  soja: LiveQuotePayload
  milho: LiveQuotePayload
  trigo: LiveQuotePayload
  usdbrl: LiveQuotePayload
  source: string
  fetchedAt: string
}

export function useLiveQuotes(intervalMs = 60_000) {
  const [data, setData] = useState<LiveQuotesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function tick() {
      try {
        const r = await fetch('/api/cotacoes/live', { cache: 'no-store' })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = (await r.json()) as LiveQuotesResponse
        if (alive) {
          setData(j)
          setError(null)
        }
      } catch (e: any) {
        if (alive) setError(e?.message || 'fetch failed')
      } finally {
        if (alive) setLoading(false)
      }
    }
    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [intervalMs])

  return { data, error, loading }
}
