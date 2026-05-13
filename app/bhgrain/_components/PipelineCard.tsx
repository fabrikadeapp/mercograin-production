'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Download } from 'lucide-react'
import { GlassCard, ScoreBadge, StatusBadge, Skeleton, ErrorState, EmptyState, fmtBRL, fmtPct, useJson } from './_shared'

interface PipelineRow {
  id: string
  clienteNome: string
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
    kpis: { valorTotalProposto: number; previsaoReceita: number }
    pipeline: PipelineRow[]
  }
}

type SortKey = 'valor' | 'margem' | 'score' | 'previsao' | 'status' | 'cliente' | 'commodity'

export function PipelineCard({ onOpenProposta }: { onOpenProposta: (id: string) => void }) {
  const { data, error, loading } = useJson<Resumo>('/api/dashboard/resumo')
  const [sortKey, setSortKey] = useState<SortKey>('valor')

  const rows = useMemo(() => {
    const arr = [...(data?.resumo?.pipeline ?? [])]
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'valor': return b.valorTotal - a.valorTotal
        case 'margem': return (b.margemPercent ?? -Infinity) - (a.margemPercent ?? -Infinity)
        case 'score': return (b.scoreInterno ?? -Infinity) - (a.scoreInterno ?? -Infinity)
        case 'previsao': return (a.previsaoCaixa ?? 'z').localeCompare(b.previsaoCaixa ?? 'z')
        case 'status': return a.status.localeCompare(b.status)
        case 'cliente': return a.clienteNome.localeCompare(b.clienteNome)
        case 'commodity': return a.commodity.localeCompare(b.commodity)
      }
    })
    return arr
  }, [data, sortKey])

  return (
    <GlassCard
      title="Pipeline de propostas"
      subtitle="Acompanhe propostas e previsão de caixa"
      action={
        <div className="flex items-center gap-3">
          <ExportButton />
          <Link href="/propostas" className="text-[11px] text-vg-fg-3 hover:text-vg-fg-primary flex items-center gap-1">
            Ver todas <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      }
    >
      {/* KPIs */}
      {data?.resumo && (
        <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b" style={{ borderColor: 'var(--vg-border-subtle)' }}>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-vg-fg-3">Valor total proposto</div>
            <div className="text-[18px] font-semibold tabular-nums">R$ {fmtBRL(data.resumo.kpis.valorTotalProposto)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-vg-fg-3">Previsão de receita</div>
            <div className="text-[18px] font-semibold tabular-nums" style={{ color: 'var(--vg-success, #10b981)' }}>
              R$ {fmtBRL(data.resumo.kpis.previsaoReceita)}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Erro ao buscar pipeline" />
      ) : rows.length === 0 ? (
        <EmptyState message="Nenhuma proposta no pipeline" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-vg-fg-3 text-left">
                <Th sortKey="cliente" active={sortKey} onClick={setSortKey}>Cliente</Th>
                <Th sortKey="commodity" active={sortKey} onClick={setSortKey}>Commodity</Th>
                <th className="font-normal pb-1.5 text-right">Qtd</th>
                <Th sortKey="valor" active={sortKey} onClick={setSortKey} align="right">Valor</Th>
                <Th sortKey="margem" active={sortKey} onClick={setSortKey} align="right">Margem</Th>
                <Th sortKey="score" active={sortKey} onClick={setSortKey} align="right">Score</Th>
                <Th sortKey="status" active={sortKey} onClick={setSortKey}>Status</Th>
                <Th sortKey="previsao" active={sortKey} onClick={setSortKey}>Previsão caixa</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onOpenProposta(r.id)}
                  className="border-t border-white/5 cursor-pointer hover:bg-white/[0.03] transition"
                >
                  <td className="py-1.5 font-medium truncate max-w-[150px]">{r.clienteNome}</td>
                  <td className="py-1.5 text-vg-fg-2">{r.commodity}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {r.quantidade != null ? `${fmtBRL(r.quantidade)} ${r.unidade ?? ''}` : '—'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">R$ {fmtBRL(r.valorTotal)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtPct(r.margemPercent)}</td>
                  <td className="py-1.5 text-right"><ScoreBadge score={r.scoreInterno} /></td>
                  <td className="py-1.5"><StatusBadge status={r.status} /></td>
                  <td className="py-1.5 text-vg-fg-2 tabular-nums whitespace-nowrap">
                    {r.previsaoCaixa ? new Date(r.previsaoCaixa).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  )
}

function Th({
  sortKey, active, onClick, children, align = 'left',
}: {
  sortKey: SortKey
  active: SortKey
  onClick: (k: SortKey) => void
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  const isActive = active === sortKey
  return (
    <th className={`font-normal pb-1.5 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        onClick={() => onClick(sortKey)}
        className={`hover:text-vg-fg-primary transition ${isActive ? 'text-vg-fg-primary font-medium' : ''}`}
      >
        {children}{isActive && ' ↓'}
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
      // Extrai filename do Content-Disposition (se vier)
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
        className="text-[11px] text-vg-fg-3 hover:text-vg-fg-primary flex items-center gap-1"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download className="w-3 h-3" /> Exportar
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-10 rounded-lg p-1 min-w-[140px] shadow-lg"
          style={{
            background: 'var(--vg-glass-card-hover, rgba(20,20,24,0.95))',
            border: '1px solid var(--vg-border-subtle, rgba(255,255,255,0.1))',
          }}
          role="menu"
        >
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => download('csv')}
            className="w-full text-left text-[12px] px-2 py-1.5 rounded hover:bg-white/10 disabled:opacity-50"
            role="menuitem"
          >
            {busy === 'csv' ? 'Gerando…' : 'CSV (.csv)'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => download('xlsx')}
            className="w-full text-left text-[12px] px-2 py-1.5 rounded hover:bg-white/10 disabled:opacity-50"
            role="menuitem"
          >
            {busy === 'xlsx' ? 'Gerando…' : 'Excel (.xlsx)'}
          </button>
          {error && <div className="text-[11px] px-2 py-1 text-red-400">{error}</div>}
        </div>
      )}
    </div>
  )
}
