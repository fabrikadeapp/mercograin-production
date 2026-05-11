'use client'
import * as React from 'react'
import {
  Card, CardHeader, CardTitle, KPICard, BarChart, ProgressBar,
  Skeleton, ErrorBanner,
} from '@/components/ui/phb'

interface Resp {
  kpis: {
    volumeTotalToneladas: number
    ebitda: number
    ebitdaMargem: number
    roic: number
    shareRegional: Record<string, number>
    comissaoTotal: number
    ticketMedio: number
    taxaSinistralidade: number
    receitaTotal: number
    despesaTotal: number
    contratosAtivos: number
  }
  volumeMensal: { label: string; toneladas: number }[]
  ebitdaMensal: { label: string; ebitda: number; receita: number; despesa: number }[]
}

const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
const fmtPct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`
const fmtT = (n: number) => `${(n / 1000).toFixed(1).replace('.', ',')}k t`

export function CLevelContent() {
  const [data, setData] = React.useState<Resp | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch('/api/bi/clevel', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setErr(String(e.message || e)))
  }, [])

  if (err) return <ErrorBanner message={err} />
  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={120} />)}
        </div>
        <Skeleton height={320} rounded="lg" />
      </div>
    )
  }

  const k = data.kpis
  const kpis = [
    { eyebrow: 'VOLUME TOTAL', value: fmtT(k.volumeTotalToneladas), subtitle: 'contratado + entregue YTD' },
    { eyebrow: 'EBITDA', value: fmtBRL(k.ebitda), subtitle: `margem ${fmtPct(k.ebitdaMargem)}` },
    { eyebrow: 'ROIC (proxy)', value: fmtPct(k.roic), subtitle: 'EBITDA / capital giro' },
    { eyebrow: 'COMISSÃO TOTAL', value: fmtBRL(k.comissaoTotal), subtitle: `${k.contratosAtivos} contratos` },
    { eyebrow: 'TICKET MÉDIO', value: fmtBRL(k.ticketMedio), subtitle: 'por contrato' },
    { eyebrow: 'RECEITA', value: fmtBRL(k.receitaTotal), subtitle: 'comissões apuradas' },
    { eyebrow: 'DESPESAS OP.', value: fmtBRL(k.despesaTotal), subtitle: 'movimentos financeiros' },
    { eyebrow: 'SINISTRALIDADE', value: fmtPct(k.taxaSinistralidade), subtitle: 'quebras/rebaixes' },
  ]

  const volumeChart = data.volumeMensal.map((m) => ({ label: m.label, value: m.toneladas }))
  const ebitdaChart = data.ebitdaMensal.map((m) => ({ label: m.label, value: Math.round(m.ebitda / 1000) }))
  const shareEntries = Object.entries(k.shareRegional).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const colors = ['var(--accent)', 'var(--grain-soja)', 'var(--grain-milho)', 'var(--grain-trigo)', 'var(--info)', 'var(--warn)']

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kp) => <KPICard key={kp.eyebrow} {...kp} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="OPERAÇÃO · 12 MESES">Volume entregue (toneladas)</CardTitle>
          </CardHeader>
          <BarChart data={volumeChart} highlightLast height={260} />
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="FINANCEIRO · 12 MESES">EBITDA mensal (R$ mil)</CardTitle>
          </CardHeader>
          <BarChart data={ebitdaChart} highlightLast height={260} />
        </Card>
      </div>

      <Card className="p-6">
        <CardHeader>
          <CardTitle eyebrow="DISTRIBUIÇÃO">Share regional · contratos por UF</CardTitle>
        </CardHeader>
        {shareEntries.length === 0 ? (
          <p className="text-fg-3 text-small">Sem dados regionais ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shareEntries.map(([uf, pct], i) => (
              <ProgressBar key={uf} label={uf} value={pct} color={colors[i % colors.length]} size="sm" />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
