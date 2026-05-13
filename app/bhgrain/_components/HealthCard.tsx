'use client'

import { Activity, AlertCircle, CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react'
import Link from 'next/link'
import { GlassCard, Skeleton, ErrorState, EmptyState, useJson } from './_shared'

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
    case 'online': return { Icon: CheckCircle2, color: 'var(--vg-success, #10b981)', label: 'Online' }
    case 'instavel': return { Icon: AlertTriangle, color: '#f59e0b', label: 'Instável' }
    case 'atraso': return { Icon: AlertCircle, color: '#f59e0b', label: 'Com atraso' }
    case 'erro': return { Icon: XCircle, color: 'var(--vg-destructive, #ef4444)', label: 'Erro' }
    case 'desconectada': return { Icon: MinusCircle, color: 'var(--vg-fg-3)', label: 'Desconectada' }
  }
}

function ageText(iso: string | null): string {
  if (!iso) return '—'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}m atrás`
  if (min < 60 * 24) return `${Math.floor(min / 60)}h atrás`
  return `${Math.floor(min / 60 / 24)}d atrás`
}

export function HealthCard() {
  // Polling 60s
  const { data, error, loading } = useJson<{ integrations: IntegrationHealth[] }>(
    '/api/bhgrain/health',
    [],
    { pollMs: 60_000 }
  )

  return (
    <GlassCard
      title="Health de integrações"
      subtitle="Status em tempo real"
      action={
        <Link href="/admin/bhgrain/integracoes" className="text-[11px] text-vg-fg-3 hover:text-vg-fg-primary flex items-center gap-1">
          <Activity className="w-3 h-3" /> Detalhes
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-1.5">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-7" />)}
        </div>
      ) : error ? (
        <ErrorState message="Erro ao carregar health" />
      ) : !data?.integrations || data.integrations.length === 0 ? (
        <EmptyState message="Nenhum health registrado. Aguarde primeiro cron." />
      ) : (
        <ul className="space-y-1">
          {data.integrations.map((h) => {
            const info = statusInfo(h.status)
            const label = INTEGRATION_LABEL[h.integration] ?? h.integration
            return (
              <li key={h.integration} className="flex items-center justify-between py-1 text-[12px]">
                <div className="flex items-center gap-2">
                  <info.Icon className="w-3.5 h-3.5 shrink-0" style={{ color: info.color }} />
                  <span className="font-medium">{label}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-vg-fg-3">
                  {h.pendingEvents > 0 && (
                    <span style={{ color: '#f59e0b' }}>{h.pendingEvents} pend.</span>
                  )}
                  <span style={{ color: info.color }}>{info.label}</span>
                  <span className="opacity-60">· {ageText(h.lastSuccessAt)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </GlassCard>
  )
}
