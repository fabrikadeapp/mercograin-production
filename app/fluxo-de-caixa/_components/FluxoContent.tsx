'use client'
import * as React from 'react'
import { Inbox } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  KPICard,
  BarChart,
  Donut,
  Tabs,
  Chip,
  DenseTable,
  EmptyState,
  Skeleton,
  ErrorBanner,
  type DenseTableColumn,
} from '@/components/ui/phb'

const PERIOD = [
  { value: 'diario', label: 'Diário' },
  { value: 'semanal', label: 'Semanal' },
]

interface ResumoApi {
  saldoAtual: number
  aReceber30d: { total: number; titulos: number; atrasados: number }
  aPagar30d: { total: number; compromissos: number; vencidos: number }
  projecao90d: number
  deltaSaldo: number
  composicao: { label: string; valor: number; pct: number; color: string }[]
  projecaoSerie: { label: string; value: number }[]
  aReceberProx7d: { id: string; cliente: string; contrato: string; vencimento: string; valor: number; status: string }[]
  aPagarProx7d: { id: string; descricao: string; doc: string; vencimento: string; valor: number; status: string }[]
}

interface Row {
  id: string
  label: string
  ref: string
  vence: string
  valor: string
  status: string
  variant: 'pos' | 'neg' | 'warn' | 'neutral'
}

function fmtBRL(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2).replace('.', ',')}M`
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`
  return `R$ ${n.toFixed(0)}`
}

function fmtVence(dt: string): string {
  const d = new Date(dt)
  const now = new Date()
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Amanhã'
  if (diffDays > 0) return `+${diffDays} dias`
  return `${diffDays} dias`
}

async function safeJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json()
}

function CashflowTable({ rows }: { rows: Row[] }) {
  const cols: DenseTableColumn<Row>[] = [
    {
      key: 'label',
      header: 'CLIENTE',
      accessor: (r) => (
        <div className="flex flex-col">
          <span className="text-fg-1 text-small">{r.label}</span>
          <span className="eyebrow t-num">{r.ref}</span>
        </div>
      ),
    },
    { key: 'vence', header: 'VENCE', accessor: (r) => <span className="text-fg-2 text-small">{r.vence}</span> },
    { key: 'valor', header: 'VALOR', accessor: (r) => <span className="t-num text-fg-1">{r.valor}</span>, align: 'right', isNumeric: true },
    { key: 'status', header: 'STATUS', accessor: (r) => <Chip variant={r.variant}>{r.status}</Chip>, align: 'right' },
  ]
  return <DenseTable columns={cols} rows={rows} rowKey={(r) => r.id} className="!border-0 !shadow-none !bg-transparent" />
}

export function FluxoContent() {
  const [period, setPeriod] = React.useState('diario')
  const [data, setData] = React.useState<ResumoApi | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancel = false
    safeJson('/api/fluxo-caixa/resumo')
      .then((d) => !cancel && setData(d))
      .catch((e) => !cancel && setError(String(e)))
    return () => { cancel = true }
  }, [])

  if (error) return <ErrorBanner message={error} />
  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={120} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton height={320} rounded="lg" />
          <Skeleton height={320} rounded="lg" />
        </div>
      </div>
    )
  }

  const kpis = [
    { eyebrow: 'SALDO ATUAL', delta: { value: `${data.deltaSaldo >= 0 ? '+' : ''}${data.deltaSaldo.toFixed(1)}%`, trend: data.deltaSaldo >= 0 ? 'pos' as const : 'neg' as const }, value: fmtBRL(data.saldoAtual), subtitle: 'Conta operacional + investimentos' },
    { eyebrow: 'A RECEBER (30D)', delta: { value: '', trend: 'pos' as const }, value: fmtBRL(data.aReceber30d.total), subtitle: `${data.aReceber30d.titulos} títulos · ${data.aReceber30d.atrasados} atrasados` },
    { eyebrow: 'A PAGAR (30D)', delta: { value: '', trend: 'neg' as const }, value: fmtBRL(data.aPagar30d.total), subtitle: `${data.aPagar30d.compromissos} compromissos · ${data.aPagar30d.vencidos} vencidos` },
    { eyebrow: 'PROJEÇÃO 90D', delta: { value: '', trend: 'pos' as const }, value: fmtBRL(data.projecao90d), subtitle: 'Cenário base · sem novos contratos', highlight: true },
  ]

  const recvRows: Row[] = data.aReceberProx7d.map((r) => ({
    id: r.id,
    label: r.cliente,
    ref: r.contrato,
    vence: fmtVence(r.vencimento),
    valor: fmtBRL(r.valor),
    status: r.status === 'vencido' ? 'atenção' : 'em dia',
    variant: r.status === 'vencido' ? 'warn' : 'pos',
  }))
  const payRows: Row[] = data.aPagarProx7d.map((r) => ({
    id: r.id,
    label: r.descricao,
    ref: r.doc,
    vence: fmtVence(r.vencimento),
    valor: fmtBRL(r.valor),
    status: r.status,
    variant: r.status === 'vencido' ? 'neg' : r.status === 'atenção' ? 'warn' : 'neutral',
  }))

  const totalDonut = data.composicao.reduce((s, c) => s + c.valor, 0)
  const donutData = data.composicao.map((c) => ({ label: c.label, value: c.valor / 1_000_000, color: c.color }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <KPICard key={k.eyebrow} eyebrow={k.eyebrow} delta={k.delta} value={k.value} subtitle={k.subtitle} highlightValue={(k as any).highlight} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="HORIZONTE 90D">Projeção · 90 dias</CardTitle>
            <Tabs options={PERIOD} value={period} onChange={setPeriod} size="sm" />
          </CardHeader>
          <p className="text-fg-3 text-small mb-4">Entradas vs saídas vs saldo acumulado</p>
          {data.projecaoSerie.length === 0 ? (
            <EmptyState icon={Inbox} title="Sem projeção" description="Cadastre contratos e boletos para gerar a projeção." />
          ) : (
            <BarChart data={data.projecaoSerie} highlightLast height={260} />
          )}
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="DISTRIBUIÇÃO">Composição</CardTitle>
          </CardHeader>
          {totalDonut === 0 ? (
            <EmptyState icon={Inbox} title="Sem composição" description="Receitas aparecerão aqui à medida que propostas forem aceitas." />
          ) : (
            <Donut data={donutData} centerValue={fmtBRL(totalDonut)} centerSubtitle="Total mês" size={220} />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="ENTRADAS">A receber · próximos 7 dias</CardTitle>
            <Chip variant="warn">{fmtBRL(recvRows.reduce((s, r) => s + parseValor(r.valor), 0))}</Chip>
          </CardHeader>
          {recvRows.length === 0 ? (
            <EmptyState icon={Inbox} title="Sem títulos" description="Boletos a receber nos próximos 7 dias aparecerão aqui." />
          ) : (
            <CashflowTable rows={recvRows} />
          )}
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle eyebrow="SAÍDAS">A pagar · próximos 7 dias</CardTitle>
            <Chip variant="neg">{fmtBRL(payRows.reduce((s, r) => s + parseValor(r.valor), 0))}</Chip>
          </CardHeader>
          {payRows.length === 0 ? (
            <EmptyState icon={Inbox} title="Sem compromissos" />
          ) : (
            <CashflowTable rows={payRows} />
          )}
        </Card>
      </div>
    </div>
  )
}

function parseValor(s: string): number {
  // "R$ 1,82M" → number
  const m = s.match(/R\$\s*([\d.,]+)\s*(M|k)?/)
  if (!m) return 0
  const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
  if (m[2] === 'M') return n * 1_000_000
  if (m[2] === 'k') return n * 1_000
  return n
}
