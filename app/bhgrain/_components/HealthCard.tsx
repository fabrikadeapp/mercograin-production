'use client'

import { Activity, AlertCircle, CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react'
import Link from 'next/link'
import { Skeleton, ErrorState, EmptyState, useJson } from './_shared'

interface IntegrationHealth {
  integration: string
  status: 'online' | 'instavel' | 'atraso' | 'erro' | 'desconectada'
  lastSuccessAt: string | null
  responseTimeMs: number | null
  pendingEvents: number
  processedEvents: number
  lastErrorMessage: string | null
  updatedAt: string
}

const INTEGRATION_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  instagram: 'Instagram',
  portal: 'Portal',
  precos: 'Preços',
  ia: 'IA',
  financeiro: 'Financeiro',
}

function statusInfo(status: IntegrationHealth['status']) {
  switch (status) {
    case 'online':       return { Icon: CheckCircle2, color: 'var(--success)', label: 'Online' }
    case 'instavel':     return { Icon: AlertTriangle, color: 'var(--warning)', label: 'Instável' }
    case 'atraso':       return { Icon: AlertCircle, color: 'var(--warning)', label: 'Atraso' }
    case 'erro':         return { Icon: XCircle, color: 'var(--danger)', label: 'Erro' }
    case 'desconectada': return { Icon: MinusCircle, color: 'var(--text-dim)', label: 'Desconectada' }
  }
}

function ageText(iso: string | null): string {
  if (!iso) return '—'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}m`
  if (min < 60 * 24) return `${Math.floor(min / 60)}h`
  return `${Math.floor(min / 60 / 24)}d`
}

/**
 * Health de integrações — versão horizontal compacta.
 * Renderiza como sec-card de altura mínima, com integrações em chips lado a lado.
 */
export function HealthCard() {
  const { data, error, loading } = useJson<{ integrations: IntegrationHealth[] }>(
    '/api/bhgrain/health',
    [],
    { pollMs: 60_000 }
  )

  return (
    <section className="sec-card" style={{ padding: '12px 16px' }}>
      <div className="flex items-center gap-4 flex-wrap">
        {/* Título compacto à esquerda */}
        <div className="flex items-center gap-2 shrink-0" style={{ minWidth: 0 }}>
          <Activity className="w-3.5 h-3.5" style={{ color: 'var(--text-dim)' }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Health · integrações
          </span>
        </div>

        {/* Divisor sutil */}
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

        {/* Lista horizontal */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex gap-3">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-5 w-24" />)}
            </div>
          ) : error ? (
            <ErrorState message="Erro" />
          ) : !data?.integrations || data.integrations.length === 0 ? (
            <EmptyState message="Aguardando primeiro cron…" />
          ) : (
            <ul className="flex items-center gap-1.5 flex-wrap">
              {data.integrations.map((h) => {
                const info = statusInfo(h.status)
                const label = INTEGRATION_LABEL[h.integration] ?? h.integration
                return (
                  <li
                    key={h.integration}
                    className="inline-flex items-center gap-1.5"
                    title={`${label}: ${info.label} · ${ageText(h.lastSuccessAt)}${h.pendingEvents > 0 ? ` · ${h.pendingEvents} pendentes` : ''}`}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 'var(--r-pill)',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-mute)',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: info.color, boxShadow: `0 0 6px ${info.color}` }}
                    />
                    <span style={{ color: 'var(--text)' }}>{label}</span>
                    {h.pendingEvents > 0 && (
                      <span style={{ color: 'var(--warning)', fontFamily: 'var(--f-mono)' }}>·{h.pendingEvents}</span>
                    )}
                    <span style={{ fontFamily: 'var(--f-mono)', opacity: 0.55, fontSize: 10 }}>
                      {ageText(h.lastSuccessAt)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Link "Detalhes" no final */}
        <Link
          href="/admin/bhgrain/integracoes"
          className="shrink-0"
          style={{ fontSize: 11, color: 'var(--text-dim)' }}
        >
          Detalhes →
        </Link>
      </div>
    </section>
  )
}
