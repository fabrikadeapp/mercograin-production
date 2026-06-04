'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  MessageCircle,
  Mail,
  Loader2,
  Phone,
} from 'lucide-react'
import { GlassCard } from '@/app/bhgrain/_components/_shared'

interface CanalKPI {
  total: number
  enviadas: number
  falhadas: number
  taxaSucesso: number
  delivered?: number
  read?: number
  deliveryRate?: number
}

interface JanelaKPI {
  whatsapp: CanalKPI
  email: CanalKPI
}

interface TopFalha {
  id: string
  canal: string
  categoria: string
  destinatario: string
  destinatarioNome: string | null
  errorMotivo: string | null
  errorCodigo: string | null
  retryCount: number
  criadoEm: string
  meta: Record<string, unknown> | null
}

interface SaudeData {
  janelas: { '24h': JanelaKPI; '7d': JanelaKPI; '30d': JanelaKPI }
  breakdownCategorias: {
    categoria: string
    total: number
    falhadas: number
    taxaSucesso: number
  }[]
  topFalhas: TopFalha[]
  whatsappInstance: {
    status: string
    phoneNumber: string | null
    connectedAt: string | null
    disconnectedAt: string | null
    lastQrAt: string | null
  } | null
  geradoEm: string
}

type Janela = '24h' | '7d' | '30d'

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`

export function SaudeNotificacoesView() {
  const [data, setData] = useState<SaudeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [janela, setJanela] = useState<Janela>('24h')
  const [retrying, setRetrying] = useState<string | null>(null)

  const carregar = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/notificacoes/saude')
      if (r.ok) {
        const j = await r.json()
        setData(j as SaudeData)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const retry = async (id: string) => {
    setRetrying(id)
    try {
      const r = await fetch(`/api/notificacoes/${id}/retry`, { method: 'POST' })
      if (r.ok) {
        await carregar()
      } else {
        const j = await r.json().catch(() => ({}))
        alert(j.error || 'Reenvio falhou')
      }
    } finally {
      setRetrying(null)
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center" style={{ color: 'var(--text-dim)' }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando…
      </div>
    )
  }

  const kpi = data.janelas[janela]
  const wa = data.whatsappInstance

  return (
    <div className="space-y-6">
      <header className="pb-2">
        <div className="eyebrow" style={{ marginBottom: 6 }}>SAÚDE · NOTIFICAÇÕES</div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>
              Saúde das notificações
            </h1>
            <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-mute)' }}>
              Visibilidade de envios outbound (email + WhatsApp) e diagnostico de falhas.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {(['24h', '7d', '30d'] as Janela[]).map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setJanela(j)}
                className="chip"
                style={{
                  background: janela === j ? 'var(--accent)' : 'var(--surface-2)',
                  color: janela === j ? 'var(--accent-ink)' : 'var(--text-mute)',
                  fontWeight: janela === j ? 600 : 400,
                  padding: '4px 12px',
                  fontSize: 12,
                }}
              >
                {j}
              </button>
            ))}
            <button
              type="button"
              onClick={carregar}
              className="chip"
              style={{ padding: '4px 8px' }}
              title="Atualizar"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>
      </header>

      {/* Status da instância WhatsApp */}
      <div
        className="rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap"
        style={{
          background:
            wa?.status === 'connected'
              ? 'rgba(74, 222, 128, 0.08)'
              : 'rgba(248, 113, 113, 0.08)',
          border: `1px solid ${wa?.status === 'connected' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
        }}
      >
        <div className="flex items-center gap-3">
          {wa?.status === 'connected' ? (
            <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--success)' }} />
          ) : (
            <XCircle className="h-5 w-5" style={{ color: 'var(--danger)' }} />
          )}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
              Instância WhatsApp: {wa?.status === 'connected' ? 'Conectada' : 'Desconectada'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
              {wa?.phoneNumber ? (
                <>
                  <Phone className="inline h-2.5 w-2.5 mr-1" />
                  {wa.phoneNumber}
                  {wa.connectedAt && ' · conectado ' + new Date(wa.connectedAt).toLocaleString('pt-BR')}
                </>
              ) : (
                'Sem instância configurada'
              )}
            </p>
          </div>
        </div>
        {wa?.status !== 'connected' && (
          <a
            href="/whatsapp"
            className="text-[12px] underline"
            style={{ color: 'var(--accent)' }}
          >
            Reconectar →
          </a>
        )}
      </div>

      {/* KPIs por canal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CanalCard
          label="WhatsApp"
          icon={<MessageCircle className="h-4 w-4" />}
          kpi={kpi.whatsapp}
          mostrarDelivery
        />
        <CanalCard
          label="Email"
          icon={<Mail className="h-4 w-4" />}
          kpi={kpi.email}
        />
      </div>

      {/* Breakdown por categoria */}
      {data.breakdownCategorias.length > 0 && (
        <GlassCard title="Volume por categoria · últimos 30d" subtitle="Onde mais mensagens são geradas">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left py-2" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Categoria
                </th>
                <th className="text-right py-2" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Total
                </th>
                <th className="text-right py-2" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Falhadas
                </th>
                <th className="text-right py-2" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Sucesso
                </th>
              </tr>
            </thead>
            <tbody>
              {data.breakdownCategorias.map((c) => (
                <tr key={c.categoria} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2 font-mono text-[12px]">{c.categoria}</td>
                  <td className="text-right py-2 tabular-nums">{c.total}</td>
                  <td
                    className="text-right py-2 tabular-nums"
                    style={{ color: c.falhadas > 0 ? 'var(--danger)' : 'var(--text-dim)' }}
                  >
                    {c.falhadas}
                  </td>
                  <td
                    className="text-right py-2 tabular-nums font-medium"
                    style={{
                      color:
                        c.taxaSucesso >= 0.95
                          ? 'var(--success)'
                          : c.taxaSucesso >= 0.8
                            ? 'var(--warning)'
                            : 'var(--danger)',
                    }}
                  >
                    {fmtPct(c.taxaSucesso)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      {/* Top falhas */}
      <GlassCard
        title={`Falhas recentes · ${data.topFalhas.length}`}
        subtitle="Clique em Reenviar para tentar de novo com mesmo destinatário e texto"
      >
        {data.topFalhas.length === 0 ? (
          <div className="py-8 text-center" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2" style={{ color: 'var(--success)' }} />
            Nenhuma falha recente. Tudo certo por aqui.
          </div>
        ) : (
          <div className="space-y-2">
            {data.topFalhas.map((f) => (
              <div
                key={f.id}
                className="rounded-md p-3 flex items-start gap-3 flex-wrap"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                }}
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className="font-mono text-[11px] rounded px-1.5 py-0.5"
                      style={{
                        background: f.canal === 'whatsapp' ? '#22c55e22' : '#3b82f622',
                        color: f.canal === 'whatsapp' ? '#16a34a' : '#2563eb',
                      }}
                    >
                      {f.canal}
                    </span>
                    <span className="font-mono text-[11px]" style={{ color: 'var(--text-dim)' }}>
                      {f.categoria}
                    </span>
                    {f.retryCount > 0 && (
                      <span className="text-[11px]" style={{ color: 'var(--warning)' }}>
                        {f.retryCount}x tentativa{f.retryCount > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-dim)' }}>
                      {new Date(f.criadoEm).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, margin: 0 }}>
                    {f.destinatarioNome ?? '—'}
                    <span style={{ color: 'var(--text-dim)' }}> · </span>
                    <span style={{ fontFamily: 'var(--f-mono)' }}>{f.destinatario}</span>
                  </p>
                  {f.errorMotivo && (
                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--danger)',
                        margin: '4px 0 0 0',
                        fontFamily: 'var(--f-mono)',
                      }}
                    >
                      {f.errorMotivo}
                      {f.errorCodigo && ` (${f.errorCodigo})`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => retry(f.id)}
                  disabled={retrying === f.id}
                  className="chip"
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    background: 'var(--accent)',
                    color: 'var(--accent-ink)',
                    fontWeight: 600,
                  }}
                >
                  {retrying === f.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reenviar
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}

interface CanalCardProps {
  label: string
  icon: React.ReactNode
  kpi: CanalKPI
  mostrarDelivery?: boolean
}

function CanalCard({ label, icon, kpi, mostrarDelivery }: CanalCardProps) {
  const cor =
    kpi.total === 0
      ? 'var(--text-dim)'
      : kpi.taxaSucesso >= 0.95
        ? 'var(--success)'
        : kpi.taxaSucesso >= 0.8
          ? 'var(--warning)'
          : 'var(--danger)'

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--text-mute)' }}>
        {icon}
        <span className="eyebrow" style={{ fontSize: 10 }}>
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <p className="tabular-nums" style={{ fontSize: 28, fontWeight: 600, color: cor, margin: 0, lineHeight: 1 }}>
          {kpi.total === 0 ? '—' : fmtPct(kpi.taxaSucesso)}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>de sucesso no envio</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]" style={{ color: 'var(--text-dim)' }}>
        <span>
          <strong style={{ color: 'var(--text)' }}>{kpi.enviadas}</strong> enviadas
        </span>
        <span>
          <strong style={{ color: kpi.falhadas > 0 ? 'var(--danger)' : 'var(--text)' }}>
            {kpi.falhadas}
          </strong>{' '}
          falhadas
        </span>
        {mostrarDelivery && (
          <>
            <span>
              <strong style={{ color: 'var(--text)' }}>{kpi.delivered ?? 0}</strong> entregues
            </span>
            <span>
              <strong style={{ color: 'var(--text)' }}>{kpi.read ?? 0}</strong> lidas
            </span>
          </>
        )}
      </div>
    </div>
  )
}
