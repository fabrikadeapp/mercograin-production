'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { GlassCard, Skeleton, ErrorState, EmptyState, fmtBRL, useJson } from './_shared'

interface Resumo {
  enabled?: boolean
  resumo?: {
    faturamentoMeta: {
      diario: { date: string; value: number }[]
      metaMensal: number
      atingido: number
      percentualMeta: number
      previsaoMes: number
      simulador: { falta: number; necessarioPorDia: number; cobrePrevisao: boolean; risco: string } | null
    }
  }
}

type Periodo = '7d' | '15d' | '30d'

const riscoLabel: Record<string, { label: string; color: string }> = {
  no_ritmo: { label: 'No ritmo', color: 'var(--vg-success, #10b981)' },
  atencao: { label: 'Atenção', color: '#f59e0b' },
  risco: { label: 'Meta em risco', color: 'var(--vg-destructive, #ef4444)' },
  critico: { label: 'Meta crítica', color: 'var(--vg-destructive, #ef4444)' },
}

export function FaturamentoMetaCard() {
  const { data, error, loading } = useJson<Resumo>('/api/dashboard/resumo')
  const [periodo, setPeriodo] = useState<Periodo>('7d')

  const fm = data?.resumo?.faturamentoMeta
  const diario = fm?.diario ?? []
  const max = Math.max(1, ...diario.map((d) => d.value))

  return (
    <GlassCard
      title="Faturamento & Meta"
      subtitle="Faturamento diário (R$)"
      status={{ online: !error, label: 'Atualizado agora' }}
    >
      <div className="flex items-center gap-1 mb-3">
        {(['7d', '15d', '30d'] as Periodo[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className="text-[11px] px-2.5 py-1 rounded-full transition"
            style={{
              background: periodo === p ? 'var(--vg-accent-primary)' : 'var(--vg-glass-pill-track)',
              color: periodo === p ? '#fff' : 'var(--vg-fg-2)',
              fontWeight: periodo === p ? 600 : 400,
            }}
          >
            {p === '7d' ? '7 dias' : p === '15d' ? '15 dias' : '30 dias'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-16" />
        </div>
      ) : error || !fm ? (
        <ErrorState message="Erro ao carregar faturamento" />
      ) : (
        <>
          {/* Gráfico de barras simples */}
          {diario.length > 0 ? (
            <div className="flex items-end justify-between gap-1 h-20 mb-3">
              {diario.map((d) => {
                const h = (d.value / max) * 100
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t transition"
                      style={{
                        height: `${Math.max(h, 2)}%`,
                        background: 'var(--vg-accent-primary)',
                        opacity: d.value > 0 ? 1 : 0.2,
                      }}
                      title={`${d.date}: R$ ${fmtBRL(d.value)}`}
                    />
                    <div className="text-[9px] text-vg-fg-3 tabular-nums">
                      {d.date.slice(8, 10)}/{d.date.slice(5, 7)}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState message="Nenhum faturamento registrado" />
          )}

          {/* Meta + atingido */}
          {fm.metaMensal > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t" style={{ borderColor: 'var(--vg-border-subtle)' }}>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-vg-fg-3">Meta mensal</div>
                  <div className="text-[14px] font-semibold tabular-nums">R$ {fmtBRL(fm.metaMensal)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-vg-fg-3">Atingido</div>
                  <div className="text-[14px] font-semibold tabular-nums" style={{ color: 'var(--vg-success, #10b981)' }}>
                    R$ {fmtBRL(fm.atingido)}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-vg-fg-3">{fm.percentualMeta}% do total</span>
                  <span className="text-vg-fg-3 tabular-nums">Previsão mês: <span style={{ color: 'var(--vg-accent-primary)' }}>R$ {fmtBRL(fm.previsaoMes)}</span></span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--vg-glass-pill-track)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, fm.percentualMeta)}%`, background: 'var(--vg-accent-primary)' }}
                  />
                </div>
              </div>

              {/* Simulador */}
              {fm.simulador && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--vg-border-subtle)' }}>
                  <div className="text-[11px] font-semibold text-vg-fg-2 mb-1.5">Simulador de meta</div>
                  <div className="text-[11px] text-vg-fg-3">Falta para meta</div>
                  <div className="text-[14px] font-semibold tabular-nums">R$ {fmtBRL(fm.simulador.falta)}</div>
                  <div className="text-[11px] text-vg-fg-3 mt-1">
                    Necessário/dia útil: <span className="text-vg-fg-2 tabular-nums">R$ {fmtBRL(fm.simulador.necessarioPorDia)}</span>
                  </div>
                  {(() => {
                    const r = riscoLabel[fm.simulador.risco] ?? { label: fm.simulador.risco, color: 'var(--vg-fg-3)' }
                    return (
                      <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold" style={{ color: r.color }}>
                        <AlertTriangle className="w-3 h-3" /> {r.label}
                      </div>
                    )
                  })()}
                </div>
              )}
            </>
          ) : (
            <EmptyState message="Sem meta configurada" />
          )}
        </>
      )}
    </GlassCard>
  )
}
