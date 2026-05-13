'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

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
    <section className={`vg-glass-card rounded-2xl p-4 flex flex-col ${className}`}>
      <header className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold tracking-tight truncate">{title}</h2>
          {subtitle && <p className="text-[11px] text-vg-fg-3 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status && (
            <span className="flex items-center gap-1 text-[11px] text-vg-fg-3">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: status.online ? 'var(--vg-success, #10b981)' : 'var(--vg-fg-3)' }}
              />
              {status.label ?? (status.online ? 'Online' : 'Offline')}
            </span>
          )}
          {action}
        </div>
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  )
}

export function Avatar({ initials, hot }: { initials: string; hot?: boolean }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
      style={{
        background: hot ? 'var(--vg-accent-primary)' : 'var(--vg-glass-card-hover)',
        color: hot ? '#fff' : 'var(--vg-fg-primary)',
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
  const map: Record<string, string> = {
    neutral: 'var(--vg-glass-pill-track)',
    success: 'rgba(16,185,129,0.15)',
    warn: 'rgba(245,158,11,0.15)',
    danger: 'rgba(239,68,68,0.15)',
    info: 'rgba(59,130,246,0.15)',
  }
  const textMap: Record<string, string> = {
    neutral: 'var(--vg-fg-2)',
    success: 'var(--vg-success, #10b981)',
    warn: '#f59e0b',
    danger: 'var(--vg-destructive, #ef4444)',
    info: 'var(--vg-accent-primary)',
  }
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-flex items-center"
      style={{ background: map[tone], color: textMap[tone] }}
    >
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
  return <div className={`vg-glass-card rounded animate-pulse ${className}`} style={{ background: 'var(--vg-glass-card-hover)' }} />
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-vg-destructive py-4">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-6 text-[12px] text-vg-fg-3">
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

// Hook simples para fetch JSON com loading/error
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

    const load = (silent: boolean) => {
      if (!silent) setLoading(true)
      setError(null)
      const ctrl = new AbortController()
      ctrlRef.current?.abort()
      ctrlRef.current = ctrl
      return fetch(url, { signal: ctrl.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`)
          return r.json()
        })
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
