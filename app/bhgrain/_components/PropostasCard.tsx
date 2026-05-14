'use client'

import Link from 'next/link'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { GlassCard, Avatar, ScoreBadge, StatusBadge, Skeleton, ErrorState, EmptyState, fmtBRL, fmtRelativeMin, useJson } from './_shared'
import { useDashboardFilters } from './DashboardFiltersContext'

interface PipelineRow {
  id: string
  clienteNome: string
  commodity: string
  quantidade: number | null
  unidade: string | null
  precoCotado: number | null
  valorTotal: number
  margemPercent: number | null
  scoreInterno: number | null
  status: string
  validadeEm: string | null
  previsaoCaixa: string | null
  proximaAcao: string | null
}

interface Resumo {
  enabled?: boolean
  resumo?: {
    pipeline: PipelineRow[]
    kpis: { propostasAbertas: number }
  }
}

function iniciais(nome: string) {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
}

function validadeMin(validadeEm: string | null): number | null {
  if (!validadeEm) return null
  return Math.round((new Date(validadeEm).getTime() - Date.now()) / 60000)
}

export function PropostasCard({ onOpenProposta }: { onOpenProposta: (id: string) => void }) {
  const filtros = useDashboardFilters()
  const { data, error, loading } = useJson<Resumo>(
    `/api/dashboard/resumo${filtros.qs}`,
    [filtros.params]
  )

  const rows = data?.resumo?.pipeline ?? []
  const count = data?.resumo?.kpis.propostasAbertas ?? 0

  return (
    <GlassCard
      title="Propostas"
      subtitle={`Ciclo de vendas (${count})`}
      action={
        <Link href="/propostas" className="text-[11px] text-vg-fg-3 hover:text-vg-fg-primary flex items-center gap-1">
          Ver todas <ArrowUpRight className="w-3 h-3" />
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Erro ao buscar propostas" />
      ) : data?.enabled === false ? (
        <EmptyState
          message="BH Grain v1 desativado"
          action={
            <Link href="/admin/bhgrain" className="text-[11px] text-vg-accent hover:underline">
              Ativar feature flag
            </Link>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          message="Nenhuma proposta aberta"
          action={
            <Link href="/propostas/nova" className="text-[11px] text-vg-accent hover:underline">
              + Criar primeira proposta
            </Link>
          }
        />
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 5).map((p) => {
            const min = validadeMin(p.validadeEm)
            const cotacaoVencida = min != null && min <= 0
            return (
              <li key={p.id}>
                <button
                  onClick={() => onOpenProposta(p.id)}
                  className="w-full text-left p-1.5 -mx-1.5 rounded-lg hover:bg-white/5 transition flex items-start gap-2.5"
                >
                  <Avatar initials={iniciais(p.clienteNome)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-[13px] font-medium truncate">{p.clienteNome}</div>
                      <ChevronRight className="w-3.5 h-3.5 text-vg-fg-3 shrink-0" aria-hidden />
                    </div>
                    <div className="text-[11px] text-vg-fg-2 truncate">
                      {p.commodity}
                      {p.quantidade != null && ` · ${p.quantidade} ${p.unidade ?? ''}`}
                      {p.precoCotado != null && (
                        <span className="ml-1 text-vg-fg-3">
                          · R$ {fmtBRL(p.precoCotado, 2)}/{p.unidade ?? 'sc'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      <StatusBadge status={p.status} />
                      <ScoreBadge score={p.scoreInterno} />
                      {p.validadeEm != null && (
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{
                            background: cotacaoVencida ? 'rgba(239,68,68,0.15)' : 'var(--vg-glass-pill-track)',
                            color: cotacaoVencida ? 'var(--vg-destructive, #ef4444)' : 'var(--vg-fg-2)',
                          }}
                        >
                          {cotacaoVencida ? 'Cotação vencida' : `Cotação ${fmtRelativeMin(min)}`}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </GlassCard>
  )
}
