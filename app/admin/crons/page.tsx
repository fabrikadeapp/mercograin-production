'use client'

import { useEffect, useState } from 'react'
import { Activity, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

interface CronSummary {
  cron: string
  lastRunAt: string | null
  lastStatus: 'success' | 'error' | 'partial' | null
  lastMessage: string | null
  lastDurationMs: number | null
  avgDurationMs: number | null
  successRate10: number | null
  runsLast24h: number
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'nunca'
  const ms = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s atrás`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

function fmtMs(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export default function CronsAdminPage() {
  const [crons, setCrons] = useState<CronSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/crons')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => setCrons(j.crons ?? []))
      .catch((e) => setErr(String(e?.message ?? e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-6">
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--f-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-dim)',
            marginBottom: 6,
          }}
        >
          SUPER-ADMIN · CRONS
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Monitor de execuções de cron
        </h1>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: 'var(--text-mute)',
          }}
        >
          Últimas execuções, duração e taxa de sucesso dos {crons?.length ?? 0} crons.
          Atualiza a cada 30s.
        </p>
      </header>

      {err && (
        <div
          style={{
            padding: 12,
            background: 'rgba(255,80,80,0.1)',
            border: '1px solid var(--danger, #ff5050)',
            color: 'var(--danger, #ff5050)',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}

      <section
        className="sec-card"
        style={{ padding: 0, overflowX: 'auto' }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            minWidth: 760,
          }}
        >
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <Th>Cron</Th>
              <Th>Status</Th>
              <Th>Última execução</Th>
              <Th align="right">Duração</Th>
              <Th align="right">Média (10)</Th>
              <Th align="right">Sucesso</Th>
              <Th align="right">24h</Th>
            </tr>
          </thead>
          <tbody>
            {loading && !crons && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 32,
                    textAlign: 'center',
                    color: 'var(--text-dim)',
                  }}
                >
                  Carregando…
                </td>
              </tr>
            )}
            {crons?.map((c) => (
              <tr key={c.cron} style={{ borderTop: '1px solid var(--border)' }}>
                <Td>
                  <code style={{ fontSize: 12, fontFamily: 'var(--f-mono)' }}>
                    {c.cron}
                  </code>
                </Td>
                <Td>
                  <StatusBadge status={c.lastStatus} />
                </Td>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock className="w-3 h-3" style={{ color: 'var(--text-dim)' }} />
                    {timeAgo(c.lastRunAt)}
                  </div>
                  {c.lastMessage && c.lastStatus === 'error' && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--danger, #ff5050)',
                        marginTop: 2,
                        maxWidth: 320,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={c.lastMessage}
                    >
                      {c.lastMessage}
                    </div>
                  )}
                </Td>
                <Td align="right">{fmtMs(c.lastDurationMs)}</Td>
                <Td align="right">{fmtMs(c.avgDurationMs)}</Td>
                <Td align="right">
                  {c.successRate10 === null ? (
                    <span style={{ color: 'var(--text-dim)' }}>—</span>
                  ) : (
                    <span
                      style={{
                        color:
                          c.successRate10 === 100
                            ? 'var(--success)'
                            : c.successRate10 < 80
                              ? 'var(--danger)'
                              : 'var(--warning)',
                      }}
                    >
                      {c.successRate10}%
                    </span>
                  )}
                </Td>
                <Td align="right">{c.runsLast24h}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      style={{
        textAlign: align ?? 'left',
        padding: '10px 14px',
        fontSize: 11,
        fontFamily: 'var(--f-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-dim)',
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <td
      style={{
        textAlign: align ?? 'left',
        padding: '10px 14px',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>nunca rodou</span>
    )
  }
  const config = {
    success: {
      icon: CheckCircle2,
      color: 'var(--success)',
      bg: 'var(--success-soft, rgba(64,200,100,0.1))',
      label: 'OK',
    },
    error: {
      icon: AlertCircle,
      color: 'var(--danger, #ff5050)',
      bg: 'rgba(255,80,80,0.1)',
      label: 'Erro',
    },
    partial: {
      icon: Activity,
      color: 'var(--warning)',
      bg: 'rgba(255,180,0,0.1)',
      label: 'Parcial',
    },
  }[status as 'success' | 'error' | 'partial']

  if (!config) return <span style={{ fontSize: 11 }}>{status}</span>
  const Icon = config.icon
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        background: config.bg,
        color: config.color,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}
