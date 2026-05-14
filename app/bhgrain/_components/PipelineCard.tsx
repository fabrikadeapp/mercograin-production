'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Download } from 'lucide-react'
import { GlassCard, Skeleton, ErrorState, EmptyState, fmtBRL, useJson } from './_shared'
import { useDashboardFilters } from './DashboardFiltersContext'

interface PipelineRow {
  id: string
  clienteNome: string
  clienteSubtitulo: string | null
  commodity: string
  quantidade: number | null
  unidade: string | null
  valorTotal: number
  margemPercent: number | null
  scoreInterno: number | null
  status: string
  previsaoCaixa: string | null
  proximaAcao: string | null
  precoCotado: number | null
}

interface Resumo {
  enabled?: boolean
  resumo?: {
    kpis: {
      valorTotalProposto: number
      previsaoReceita: number
      margemMedia: number | null
      ticketMedio: number | null
    }
    pipeline: PipelineRow[]
  }
}

/** Cores avatar quadrado derivadas do hash do nome — paleta NewDB v2. */
function avatarColor(nome: string): { bg: string; fg: string } {
  const palette = [
    { bg: '#A8C5FF', fg: '#0A1A3D' }, // azul claro
    { bg: '#C8F051', fg: '#0A0B0E' }, // lime accent
    { bg: '#F5A86B', fg: '#3A1A00' }, // laranja
    { bg: '#B98AF5', fg: '#1F0A3D' }, // roxo
    { bg: '#7FA8FF', fg: '#0A1530' }, // azul médio
    { bg: '#79E0AB', fg: '#0A2A1A' }, // verde
    { bg: '#F47B7B', fg: '#3A0A0A' }, // vermelho rosado
  ]
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0
  return palette[h % palette.length]!
}

function initials(nome: string): string {
  const parts = nome
    .replace(/[^\p{L}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

const COMMODITY_STYLE: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  soja: { bg: 'rgba(127, 168, 255, 0.16)', fg: '#A8C5FF', border: 'rgba(127, 168, 255, 0.3)', label: 'Soja' },
  milho: { bg: 'rgba(245, 168, 107, 0.16)', fg: '#F5C58B', border: 'rgba(245, 168, 107, 0.3)', label: 'Milho' },
  trigo: { bg: 'rgba(121, 224, 171, 0.16)', fg: '#79E0AB', border: 'rgba(121, 224, 171, 0.3)', label: 'Trigo' },
  sorgo: { bg: 'rgba(185, 138, 245, 0.16)', fg: '#B98AF5', border: 'rgba(185, 138, 245, 0.3)', label: 'Sorgo' },
  aveia: { bg: 'rgba(244, 123, 123, 0.16)', fg: '#F47B7B', border: 'rgba(244, 123, 123, 0.3)', label: 'Aveia' },
}

const STATUS_STYLE: Record<string, { dot: string; fg: string; bg: string; border: string; label: string }> = {
  rascunho: { dot: 'var(--text-mute)', fg: 'var(--text-mute)', bg: 'rgba(255,255,255,0.04)', border: 'var(--border)', label: 'Rascunho' },
  enviada: { dot: '#7FA8FF', fg: '#A8C5FF', bg: 'rgba(127, 168, 255, 0.12)', border: 'rgba(127, 168, 255, 0.3)', label: 'Enviada' },
  em_negociacao: { dot: '#F5A86B', fg: '#F5C58B', bg: 'rgba(245, 168, 107, 0.12)', border: 'rgba(245, 168, 107, 0.3)', label: 'Em negociação' },
  'em negociação': { dot: '#F5A86B', fg: '#F5C58B', bg: 'rgba(245, 168, 107, 0.12)', border: 'rgba(245, 168, 107, 0.3)', label: 'Em negociação' },
  aceita: { dot: 'var(--success)', fg: 'var(--success)', bg: 'var(--success-soft)', border: 'rgba(74,222,128,0.3)', label: 'Sucesso' },
  sucesso: { dot: 'var(--success)', fg: 'var(--success)', bg: 'var(--success-soft)', border: 'rgba(74,222,128,0.3)', label: 'Sucesso' },
  aprovada: { dot: 'var(--success)', fg: 'var(--success)', bg: 'var(--success-soft)', border: 'rgba(74,222,128,0.3)', label: 'Aprovada' },
  recusada: { dot: 'var(--danger)', fg: 'var(--danger)', bg: 'var(--danger-soft)', border: 'rgba(248,113,113,0.3)', label: 'Recusada' },
  rejeitada: { dot: 'var(--danger)', fg: 'var(--danger)', bg: 'var(--danger-soft)', border: 'rgba(248,113,113,0.3)', label: 'Rejeitada' },
  expirada: { dot: 'var(--warning)', fg: 'var(--warning)', bg: 'var(--warning-soft)', border: 'rgba(251,191,36,0.3)', label: 'Expirada' },
}

function fmtCompactBRL(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace('.', ',')}M`
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(2).replace('.', ',')}k`
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

type SortKey = 'valor' | 'margem' | 'score' | 'previsao' | 'status' | 'cliente' | 'commodity'

export function PipelineCard({ onOpenProposta }: { onOpenProposta: (id: string) => void }) {
  const filtros = useDashboardFilters()
  const { data, error, loading } = useJson<Resumo>(
    `/api/dashboard/resumo${filtros.qs}`,
    [filtros.params]
  )
  const [sortKey, setSortKey] = useState<SortKey>('valor')

  const rows = useMemo(() => {
    const arr = [...(data?.resumo?.pipeline ?? [])]
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'valor':
          return b.valorTotal - a.valorTotal
        case 'margem':
          return (b.margemPercent ?? -Infinity) - (a.margemPercent ?? -Infinity)
        case 'score':
          return (b.scoreInterno ?? -Infinity) - (a.scoreInterno ?? -Infinity)
        case 'previsao':
          return (a.previsaoCaixa ?? 'z').localeCompare(b.previsaoCaixa ?? 'z')
        case 'status':
          return a.status.localeCompare(b.status)
        case 'cliente':
          return a.clienteNome.localeCompare(b.clienteNome)
        case 'commodity':
          return a.commodity.localeCompare(b.commodity)
      }
    })
    return arr
  }, [data, sortKey])

  const kpis = data?.resumo?.kpis

  return (
    <GlassCard
      title="Pipeline de propostas"
      subtitle="acompanhe propostas e previsão de caixa"
      action={
        <div className="flex items-center gap-3">
          <ExportButton />
          <Link
            href="/propostas"
            className="text-[11px] flex items-center gap-1 transition"
            style={{ color: 'var(--text-mute)' }}
          >
            Ver todas <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      }
    >
      {/* KPIs — 4 colunas alinhadas conforme design v2 */}
      {kpis && (
        <div
          className="mb-4 pb-4 border-b grid grid-cols-2 md:grid-cols-4 gap-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <Kpi label="Valor total proposto" value={fmtCompactBRL(kpis.valorTotalProposto)} />
          <Kpi
            label="Previsão de caixa"
            value={fmtCompactBRL(kpis.previsaoReceita)}
            accent
          />
          <Kpi
            label="Margem média"
            value={kpis.margemMedia != null ? `${kpis.margemMedia.toFixed(1).replace('.', ',')}%` : '—'}
            muted
          />
          <Kpi
            label="Ticket médio"
            value={kpis.ticketMedio != null ? fmtCompactBRL(kpis.ticketMedio) : '—'}
            muted
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Erro ao buscar pipeline" />
      ) : rows.length === 0 ? (
        <EmptyState message="Nenhuma proposta no pipeline" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ color: 'var(--text-dim)' }}>
                <Th sortKey="cliente" active={sortKey} onClick={setSortKey}>
                  Cliente
                </Th>
                <Th sortKey="commodity" active={sortKey} onClick={setSortKey}>
                  Commodity
                </Th>
                <th className="font-normal pb-2 eyebrow text-right">
                  Qtd. <span style={{ opacity: 0.6 }}>(sc)</span>
                </th>
                <Th sortKey="valor" active={sortKey} onClick={setSortKey} align="right">
                  Valor
                </Th>
                <Th sortKey="score" active={sortKey} onClick={setSortKey} align="right">
                  Score
                </Th>
                <Th sortKey="status" active={sortKey} onClick={setSortKey}>
                  Status
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r) => {
                const color = avatarColor(r.clienteNome)
                const cmd =
                  COMMODITY_STYLE[r.commodity.toLowerCase()] ?? {
                    bg: 'var(--surface-2)',
                    fg: 'var(--text-mute)',
                    border: 'var(--border)',
                    label: r.commodity,
                  }
                const stRaw = r.status.toLowerCase()
                const st =
                  STATUS_STYLE[stRaw] ??
                  STATUS_STYLE[stRaw.replace(/_/g, ' ')] ??
                  { dot: 'var(--text-mute)', fg: 'var(--text-mute)', bg: 'var(--surface-2)', border: 'var(--border)', label: r.status }
                const score = r.scoreInterno ?? null
                return (
                  <tr
                    key={r.id}
                    onClick={() => onOpenProposta(r.id)}
                    className="border-t cursor-pointer transition"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tint-2pct)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Cliente — avatar quadrado colorido + nome + subtítulo */}
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: color.bg,
                            color: color.fg,
                            fontFamily: 'var(--f-mono)',
                            fontWeight: 700,
                            fontSize: 11,
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {initials(r.clienteNome)}
                        </div>
                        <div className="min-w-0">
                          <div
                            className="truncate"
                            style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}
                          >
                            {r.clienteNome}
                          </div>
                          {r.clienteSubtitulo && (
                            <div
                              className="truncate"
                              style={{ fontSize: 11, color: 'var(--text-dim)' }}
                            >
                              {r.clienteSubtitulo}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Commodity — chip colorido pílula */}
                    <td className="py-3 pr-3">
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 12px',
                          borderRadius: 999,
                          background: cmd.bg,
                          color: cmd.fg,
                          border: `1px solid ${cmd.border}`,
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {cmd.label}
                      </span>
                    </td>

                    {/* Qtd em sacas */}
                    <td className="py-3 pr-3 text-right tabular-nums" style={{ fontSize: 13 }}>
                      {r.quantidade != null
                        ? r.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
                        : '—'}
                    </td>

                    {/* Valor */}
                    <td className="py-3 pr-3 text-right tabular-nums" style={{ fontSize: 13 }}>
                      R$ {fmtBRL(r.valorTotal)}
                    </td>

                    {/* Score — barra de progresso lime */}
                    <td className="py-3 pr-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div
                          style={{
                            width: 56,
                            height: 6,
                            background: 'var(--surface-3)',
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(0, Math.min(100, score ?? 0))}%`,
                              height: '100%',
                              background: 'var(--accent)',
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            minWidth: 22,
                            color: 'var(--text)',
                          }}
                        >
                          {score ?? '—'}
                        </span>
                      </div>
                    </td>

                    {/* Status — chip com dot */}
                    <td className="py-3">
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 12px',
                          borderRadius: 999,
                          background: st.bg,
                          color: st.fg,
                          border: `1px solid ${st.border}`,
                          fontSize: 11,
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 999,
                            background: st.dot,
                          }}
                        />
                        {st.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  )
}

function Kpi({
  label,
  value,
  accent,
  muted,
}: {
  label: string
  value: string
  accent?: boolean
  muted?: boolean
}) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div
        className="tabular-nums"
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: accent ? 'var(--accent)' : muted ? 'var(--text-mute)' : 'var(--text)',
          fontFamily: 'var(--f-sans)',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function Th({
  sortKey,
  active,
  onClick,
  children,
  align = 'left',
}: {
  sortKey: SortKey
  active: SortKey
  onClick: (k: SortKey) => void
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  const isActive = active === sortKey
  return (
    <th className={`font-normal pb-2 eyebrow ${align === 'right' ? 'text-right' : ''}`}>
      <button
        onClick={() => onClick(sortKey)}
        className="transition"
        style={{
          color: isActive ? 'var(--text)' : 'inherit',
          fontWeight: isActive ? 500 : 'inherit',
        }}
      >
        {children}
        {isActive && ' ↓'}
      </button>
    </th>
  )
}

function ExportButton() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<null | 'csv' | 'xlsx'>(null)
  const [error, setError] = useState<string | null>(null)

  async function download(format: 'csv' | 'xlsx') {
    setBusy(format)
    setError(null)
    try {
      const res = await fetch(`/api/bhgrain/export/pipeline?format=${format}`)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') ?? ''
      const m = /filename="([^"]+)"/.exec(cd)
      const filename = m ? m[1] : `bhgrain_pipeline.${format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao exportar')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] flex items-center gap-1 transition"
        style={{ color: 'var(--text-mute)' }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="w-3 h-3" /> Exportar
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-10 rounded-lg p-1 min-w-[140px]"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--sh-3)',
          }}
          role="menu"
        >
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => download('csv')}
            className="w-full text-left text-[12px] px-2 py-1.5 rounded disabled:opacity-50"
            style={{ color: 'var(--text)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tint-4pct)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            role="menuitem"
          >
            {busy === 'csv' ? 'Gerando…' : 'CSV (.csv)'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => download('xlsx')}
            className="w-full text-left text-[12px] px-2 py-1.5 rounded disabled:opacity-50"
            style={{ color: 'var(--text)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tint-4pct)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            role="menuitem"
          >
            {busy === 'xlsx' ? 'Gerando…' : 'Excel (.xlsx)'}
          </button>
          {error && (
            <div className="text-[11px] px-2 py-1" style={{ color: 'var(--danger)' }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
