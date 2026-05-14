'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * GlassCard — reskin NewDB v2.
 * Usa .sec-card (do styles/newdb.css). Header com title/subtitle e action area.
 * Mantém API original para compatibilidade com os 8 cards do BH Grain.
 */
export function GlassCard({
  title,
  subtitle,
  action,
  status,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  status?: { online: boolean; label?: string }
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`sec-card flex flex-col ${className}`}>
      <header className="sec-head">
        <div className="min-w-0">
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h3>
          {subtitle && (
            <div className="sub" style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
        <div className="actions flex items-center gap-2 shrink-0">
          {status && (
            <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: status.online ? 'var(--success)' : 'var(--text-dim)' }}
              />
              {status.label ?? (status.online ? 'Online' : 'Offline')}
            </span>
          )}
          {action}
        </div>
      </header>
      <div className="flex-1 min-h-0" style={{ padding: '16px 20px 18px' }}>{children}</div>
    </section>
  )
}

export function Avatar({ initials, hot }: { initials: string; hot?: boolean }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
      style={{
        background: hot ? 'var(--accent)' : 'var(--surface-2)',
        color: hot ? 'var(--accent-ink)' : 'var(--text)',
        border: '1px solid var(--border)',
      }}
    >
      {initials}
    </div>
  )
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'info'
}) {
  // NewDB v2: usa classes .badge.{tone} do newdb.css quando possível
  const cls =
    tone === 'success'
      ? 'badge success'
      : tone === 'warn'
        ? 'badge warning'
        : tone === 'danger'
          ? 'badge danger'
          : tone === 'info'
            ? 'badge info'
            : 'badge neutral'
  return (
    <span className={cls} style={{ fontSize: 10 }}>
      {tone !== 'neutral' && <span className="dot" />}
      {label}
    </span>
  )
}

export function fmtBRL(n: number, digits = 0): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function fmtPct(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const s = n > 0 ? '+' : ''
  return `${s}${n.toFixed(digits)}%`
}

export function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(today.getTime() - 86400000)
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function fmtRelativeMin(min: number | null): string {
  if (min == null) return '—'
  if (min <= 0) return 'vencida'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`skel rounded animate-pulse ${className}`}
      style={{
        background:
          'linear-gradient(90deg, var(--skel-1) 0%, var(--skel-2) 50%, var(--skel-1) 100%)',
        backgroundSize: '200% 100%',
        animation: 'skel-shimmer 1.6s ease-in-out infinite',
      }}
    />
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 py-4" style={{ fontSize: 12, color: 'var(--danger)' }}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-6" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
      <div>{message}</div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ScoreBadge({ score, label }: { score: number | null; label?: string | null }) {
  if (score == null) return <span className="text-[11px] text-vg-fg-3 tabular-nums">—</span>
  const tone: 'success' | 'info' | 'warn' | 'danger' =
    score >= 75 ? 'success' : score >= 50 ? 'info' : score >= 30 ? 'warn' : 'danger'
  const lbl = label ?? (score >= 75 ? 'alta' : score >= 50 ? 'média' : score >= 30 ? 'baixa' : 'risco')
  return <Badge tone={tone} label={`${score}% · ${lbl}`} />
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  const tone: 'info' | 'warn' | 'success' | 'danger' | 'neutral' =
    s === 'sucesso' || s === 'aceita' || s === 'concluido'
      ? 'success'
      : s === 'recusada'
        ? 'danger'
        : s === 'enviada' || s === 'em_negociacao' || s === 'em negociação'
          ? 'info'
          : s === 'pendente'
            ? 'warn'
            : 'neutral'
  const labelMap: Record<string, string> = {
    rascunho: 'Rascunho',
    rascunho_ia: 'Rascunho IA',
    'rascunho ia': 'Rascunho IA',
    pronta_para_enviar: 'Pronta',
    'pronta para enviar': 'Pronta',
    em_negociacao: 'Em negociação',
    'em negociação': 'Em negociação',
  }
  return <Badge tone={tone} label={labelMap[s] ?? status} />
}

/**
 * Cache in-memory por URL com 2 garantias:
 *  1. Dedup de requests in-flight (N cards → 1 fetch real)
 *  2. Cache de 5s — recarregar o componente reaproveita o resultado
 *
 * Isso é crítico no dashboard porque /api/dashboard/resumo é consumido
 * por 4 cards simultâneos (Propostas, Pipeline, Indicadores, Faturamento).
 */
const _inflight = new Map<string, Promise<any>>()
const _cache = new Map<string, { at: number; data: any }>()
const CACHE_TTL_MS = 5_000

function fetchJsonShared<T>(url: string, signal: AbortSignal): Promise<T> {
  const cached = _cache.get(url)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return Promise.resolve(cached.data as T)
  }
  const existing = _inflight.get(url)
  if (existing) return existing as Promise<T>

  const p = fetch(url, { signal })
    .then((r) => {
      if (!r.ok) throw new Error(`${r.status}`)
      return r.json() as Promise<T>
    })
    .then((j) => {
      _cache.set(url, { at: Date.now(), data: j })
      return j
    })
    .finally(() => {
      _inflight.delete(url)
    })
  _inflight.set(url, p)
  return p
}

// Hook simples para fetch JSON com loading/error + dedup global
export function useJson<T>(
  url: string | null,
  deps: React.DependencyList = [],
  options: { pollMs?: number } = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const ctrlRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!url) {
      setLoading(false)
      return
    }

    // Hit imediato de cache evita o "loading skeleton" piscando
    const cached = _cache.get(url)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setData(cached.data as T)
      setLoading(false)
    }

    const load = (silent: boolean) => {
      if (!silent && !(_cache.get(url) && Date.now() - (_cache.get(url)?.at ?? 0) < CACHE_TTL_MS)) {
        setLoading(true)
      }
      setError(null)
      const ctrl = new AbortController()
      ctrlRef.current?.abort()
      ctrlRef.current = ctrl
      return fetchJsonShared<T>(url, ctrl.signal)
        .then((j) => setData(j))
        .catch((e: unknown) => {
          if (e instanceof Error && e.name === 'AbortError') return
          setError(e instanceof Error ? e.message : 'Erro')
        })
        .finally(() => {
          if (!silent) setLoading(false)
        })
    }

    load(false)

    let intervalId: ReturnType<typeof setInterval> | null = null
    if (options.pollMs && options.pollMs > 0) {
      intervalId = setInterval(() => {
        // Polling silencioso (não dispara loading skeleton)
        load(true)
      }, options.pollMs)
    }

    return () => {
      ctrlRef.current?.abort()
      if (intervalId) clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading }
}
