'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, AlertTriangle, Sparkles, Bell } from 'lucide-react'

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
}

interface Resumo {
  kpis: {
    valorTotalProposto: number
    previsaoReceita: number
    clientesAtivos: number
    propostasAbertas: number
  }
  pipeline: PipelineRow[]
  indicadores: {
    funil: { totalRecebidos: number; enviadas: number; emNegociacao: number; sucesso: number; recusadas: number }
    qualidade: { scoreMedio: number | null; margemMedia: number | null; propostasCotacaoVencida: number; followUpsPendentes: number }
    risco: { precoVencido: number; margemBaixa: number; paradas: number; semResposta: number }
  }
  faturamentoMeta: {
    diario: { date: string; value: number }[]
    metaMensal: number
    atingido: number
    percentualMeta: number
    previsaoMes: number
    simulador: { falta: number; necessarioPorDia: number; cobrePrevisao: boolean; risco: string } | null
  }
  alertasAbertos: number
}

function fmtBRL(n: number, digits = 0): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    rascunho: 'Rascunho',
    rascunho_ia: 'Rascunho IA',
    'rascunho ia': 'Rascunho IA',
    pendente: 'Pendente',
    pronta_para_enviar: 'Pronta',
    enviada: 'Enviada',
    em_negociacao: 'Em negociação',
    'em negociação': 'Em negociação',
    sucesso: 'Sucesso',
    recusada: 'Recusada',
  }
  return map[s.toLowerCase()] ?? s
}

function scoreBadge(score: number | null): { label: string; color: string } {
  if (score == null) return { label: '—', color: 'text-vg-fg-3' }
  if (score >= 75) return { label: `${score}% · alta`, color: 'text-vg-success' }
  if (score >= 50) return { label: `${score}% · média`, color: 'text-vg-fg-2' }
  return { label: `${score}% · baixa`, color: 'text-vg-destructive' }
}

export function BhGrainCards() {
  const [data, setData] = useState<Resumo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/resumo')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (!j.enabled) {
          setEnabled(false)
          setLoading(false)
          return
        }
        setEnabled(true)
        setData(j.resumo)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Erro')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (enabled === false) return null
  if (loading) return <BhGrainSkeleton />
  if (error) return <BhGrainError error={error} />
  if (!data) return null

  return (
    <section className="mt-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-vg-accent" />
          <h2 className="text-[15px] font-semibold tracking-tight">BH Grain · Pipeline comercial</h2>
        </div>
        <div className="flex items-center gap-3">
          {data.alertasAbertos > 0 && (
            <Link
              href="/admin/alertas"
              className="flex items-center gap-1.5 text-[12px] text-vg-fg-2 hover:text-vg-fg-primary"
            >
              <Bell className="h-3.5 w-3.5" />
              {data.alertasAbertos} alertas
            </Link>
          )}
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Valor total proposto" value={`R$ ${fmtBRL(data.kpis.valorTotalProposto)}`} />
        <Kpi label="Previsão de receita" value={`R$ ${fmtBRL(data.kpis.previsaoReceita)}`} accent />
        <Kpi label="Propostas abertas" value={String(data.kpis.propostasAbertas)} />
        <Kpi label="Clientes ativos" value={String(data.kpis.clientesAtivos)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline */}
        <div className="lg:col-span-2 vg-glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold tracking-tight">Pipeline de propostas</h3>
            <Link href="/propostas" className="text-[11px] text-vg-fg-3 hover:text-vg-fg-primary flex items-center gap-1">
              Ver todas <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {data.pipeline.length === 0 ? (
            <EmptyHint>Nenhuma proposta aberta</EmptyHint>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-vg-fg-3 border-b" style={{ borderColor: 'var(--vg-border-subtle)' }}>
                    <th className="py-2 pr-2">Cliente</th>
                    <th className="py-2 pr-2">Commodity</th>
                    <th className="py-2 pr-2 text-right">Valor</th>
                    <th className="py-2 pr-2 text-right">Margem</th>
                    <th className="py-2 pr-2 text-right">Score</th>
                    <th className="py-2 pr-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pipeline.slice(0, 8).map((r) => {
                    const sb = scoreBadge(r.scoreInterno)
                    return (
                      <tr key={r.id} className="border-b last:border-0" style={{ borderColor: 'var(--vg-border-subtle)' }}>
                        <td className="py-2 pr-2 font-medium">{r.clienteNome}</td>
                        <td className="py-2 pr-2 text-vg-fg-2">
                          {r.commodity}
                          {r.quantidade != null ? ` · ${r.quantidade} ${r.unidade ?? ''}` : ''}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">R$ {fmtBRL(r.valorTotal)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {r.margemPercent != null ? `${r.margemPercent.toFixed(2)}%` : '—'}
                        </td>
                        <td className={`py-2 pr-2 text-right tabular-nums ${sb.color}`}>{sb.label}</td>
                        <td className="py-2 pr-2 text-vg-fg-2">{statusLabel(r.status)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Indicadores + Faturamento */}
        <div className="space-y-4">
          <div className="vg-glass-card rounded-2xl p-4">
            <h3 className="text-[13px] font-semibold tracking-tight mb-3">Funil</h3>
            <IndicadorRow label="Recebidos" value={data.indicadores.funil.totalRecebidos} />
            <IndicadorRow label="Enviadas" value={data.indicadores.funil.enviadas} />
            <IndicadorRow label="Em negociação" value={data.indicadores.funil.emNegociacao} />
            <IndicadorRow label="Sucesso" value={data.indicadores.funil.sucesso} positivo />
            <IndicadorRow label="Recusadas" value={data.indicadores.funil.recusadas} negativo />
          </div>

          <div className="vg-glass-card rounded-2xl p-4">
            <h3 className="text-[13px] font-semibold tracking-tight mb-3">Faturamento & Meta</h3>
            {data.faturamentoMeta.metaMensal > 0 ? (
              <>
                <MetricLine label="Meta mensal" value={`R$ ${fmtBRL(data.faturamentoMeta.metaMensal)}`} />
                <MetricLine label="Atingido" value={`R$ ${fmtBRL(data.faturamentoMeta.atingido)}`} positivo />
                <MetricLine label="Previsão mês" value={`R$ ${fmtBRL(data.faturamentoMeta.previsaoMes)}`} accent />
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--vg-glass-pill-track)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, data.faturamentoMeta.percentualMeta)}%`,
                      background: 'var(--vg-accent-primary)',
                    }}
                  />
                </div>
                <div className="text-[11px] text-vg-fg-3 mt-1.5">{data.faturamentoMeta.percentualMeta}% da meta</div>
                {data.faturamentoMeta.simulador && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--vg-border-subtle)' }}>
                    <div className="text-[11px] text-vg-fg-3 mb-1">Falta para meta</div>
                    <div className="text-[14px] font-semibold tabular-nums">R$ {fmtBRL(data.faturamentoMeta.simulador.falta)}</div>
                    <div className="text-[11px] text-vg-fg-3 mt-1">
                      Necessário/dia útil: R$ {fmtBRL(data.faturamentoMeta.simulador.necessarioPorDia)}
                    </div>
                    <RiscoBadge risco={data.faturamentoMeta.simulador.risco} />
                  </div>
                )}
              </>
            ) : (
              <EmptyHint>
                Sem meta configurada. <Link href="/admin/metas" className="underline">Configurar</Link>
              </EmptyHint>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="vg-glass-card rounded-2xl p-4">
      <div className="text-[11px] text-vg-fg-3 mb-1">{label}</div>
      <div className={`text-[22px] font-semibold tabular-nums ${accent ? 'text-vg-success' : ''}`}>{value}</div>
    </div>
  )
}

function IndicadorRow({ label, value, positivo, negativo }: { label: string; value: number; positivo?: boolean; negativo?: boolean }) {
  const cls = positivo ? 'text-vg-success' : negativo ? 'text-vg-destructive' : ''
  return (
    <div className="flex items-center justify-between py-1.5 text-[12px]">
      <span className="text-vg-fg-3">{label}</span>
      <span className={`font-semibold tabular-nums ${cls}`}>{value}</span>
    </div>
  )
}

function MetricLine({ label, value, positivo, accent }: { label: string; value: string; positivo?: boolean; accent?: boolean }) {
  const cls = positivo ? 'text-vg-success' : accent ? 'text-vg-accent' : ''
  return (
    <div className="flex items-center justify-between py-1 text-[12px]">
      <span className="text-vg-fg-3">{label}</span>
      <span className={`font-semibold tabular-nums ${cls}`}>{value}</span>
    </div>
  )
}

function RiscoBadge({ risco }: { risco: string }) {
  const map: Record<string, { label: string; color: string }> = {
    no_ritmo: { label: 'No ritmo', color: 'text-vg-success' },
    atencao: { label: 'Atenção', color: 'text-vg-fg-2' },
    risco: { label: 'Meta em risco', color: 'text-vg-destructive' },
    critico: { label: 'Meta crítica', color: 'text-vg-destructive' },
  }
  const r = map[risco] ?? { label: risco, color: 'text-vg-fg-3' }
  return <div className={`text-[11px] font-semibold mt-2 flex items-center gap-1 ${r.color}`}><AlertTriangle className="h-3 w-3" />{r.label}</div>
}

function BhGrainSkeleton() {
  return (
    <section className="mt-6 space-y-4">
      <div className="h-5 w-48 vg-glass-card rounded animate-pulse" />
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 vg-glass-card rounded-2xl animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-64 vg-glass-card rounded-2xl animate-pulse" />
        <div className="h-64 vg-glass-card rounded-2xl animate-pulse" />
      </div>
    </section>
  )
}

function BhGrainError({ error }: { error: string }) {
  return (
    <section className="mt-6 vg-glass-card rounded-2xl p-4 text-[12px] text-vg-destructive flex items-center gap-2">
      <AlertTriangle className="h-4 w-4" />
      Não foi possível carregar o resumo BH Grain: {error}
    </section>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] text-vg-fg-3 py-4 text-center">{children}</div>
}
