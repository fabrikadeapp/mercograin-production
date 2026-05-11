'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Download, MoreHorizontal, Inbox } from 'lucide-react'
import {
  Card,
  CardHeader,
  Tabs,
  Pill,
  Button,
  IconButton,
  GrainBadge,
  Badge,
  PipelineStageCard,
  DenseTable,
  EmptyState,
  Skeleton,
  ErrorBanner,
  type DenseTableColumn,
} from '@/components/ui/phb'
import type { ContractRow } from '@/lib/mocks/phb'

const FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
  { value: 'outros', label: 'Outros' },
]

async function safeJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json()
}

function statusToVariant(s: string): any {
  if (s === 'assinado') return 'assinado'
  if (s === 'pendente') return 'pendente'
  if (s === 'rejeitado') return 'cancelado'
  return 'pendente'
}

function fmtDate(d: string | Date): string {
  const date = new Date(d)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function ContratosContent() {
  const [filter, setFilter] = React.useState('todos')
  const [funil, setFunil] = React.useState<{ items: any[] } | null>(null)
  const [contratos, setContratos] = React.useState<any[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancel = false
    Promise.all([
      safeJson('/api/contratos/funil').catch(() => null),
      safeJson('/api/contratos?limit=20').catch(() => null),
    ])
      .then(([f, c]) => {
        if (cancel) return
        setFunil(f)
        setContratos(c?.data || [])
      })
      .catch((e) => !cancel && setError(String(e)))
    return () => { cancel = true }
  }, [])

  if (error) return <ErrorBanner message={error} />

  const stages = funil?.items || []
  const rows: ContractRow[] = (contratos || []).map((c: any) => {
    const grainArr = Array.isArray(c?.proposta?.graos) ? c.proposta.graos : []
    const firstGrao = grainArr[0]?.grao || 'soja'
    const totalSc = grainArr.reduce((s: number, g: any) => s + Number(g?.quantidade || 0), 0)
    const valor = Number(c?.proposta?.valorTotal || 0)
    const preco = totalSc > 0 ? valor / totalSc : 0
    return {
      id: c.id,
      numero: c.numero,
      cliente: c?.cliente?.nome || '—',
      grao: firstGrao,
      volume: totalSc.toLocaleString('pt-BR'),
      preco: preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      total: valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      vence: c.dataFim ? fmtDate(c.dataFim) : '—',
      status: statusToVariant(c.statusAssinatura),
    }
  })

  const filtered = filter === 'todos' ? rows : rows.filter((r) => r.grao === filter || (filter === 'outros' && !['soja', 'milho', 'trigo'].includes(r.grao as string)))

  const cols: DenseTableColumn<ContractRow>[] = [
    { key: 'numero', header: 'CONTRATO', accessor: (r) => <span className="t-num text-fg-1">{r.numero}</span> },
    { key: 'cliente', header: 'CLIENTE', accessor: (r) => <span className="text-fg-1">{r.cliente}</span> },
    { key: 'grao', header: 'GRÃO', accessor: (r) => <GrainBadge variant={r.grao} /> },
    { key: 'volume', header: 'VOLUME (SC)', accessor: (r) => <span className="t-num">{r.volume}</span>, align: 'right', isNumeric: true },
    { key: 'preco', header: 'PREÇO (R$)', accessor: (r) => <span className="t-num">{r.preco}</span>, align: 'right', isNumeric: true },
    { key: 'total', header: 'TOTAL (R$)', accessor: (r) => <span className="t-num text-fg-1">{r.total}</span>, align: 'right', isNumeric: true },
    { key: 'vence', header: 'VENCE', accessor: (r) => <span className="text-fg-2 text-small">{r.vence}</span> },
    { key: 'status', header: 'STATUS', accessor: (r) => <Badge variant={r.status} /> },
    {
      key: 'actions', header: '',
      accessor: () => <IconButton aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></IconButton>,
      align: 'right',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {!funil
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={120} />)
          : stages.map((s: any) => (
              <PipelineStageCard key={s.stage} stage={s.stage} count={s.count} percent={s.percent} total={s.total} color={s.color} />
            ))}
      </div>

      <Card className="p-6">
        <CardHeader>
          <Tabs options={FILTERS} value={filter} onChange={setFilter} size="sm" />
          <div className="flex items-center gap-3">
            <Pill>Últimos 30 dias</Pill>
            <Button variant="ghost" leftIcon={<Download className="h-4 w-4" />}>CSV</Button>
          </div>
        </CardHeader>
        {!contratos ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={36} />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Inbox} title="Sem contratos" description="Crie seu primeiro contrato a partir de uma proposta aceita." />
        ) : (
          <DenseTable
            columns={cols}
            rows={filtered}
            rowKey={(r) => r.numero}
            onRowClick={(r) => {
              if (r.id) router.push(`/contratos/${r.id}`)
            }}
            className="!border-0 !shadow-none !bg-transparent"
          />
        )}
      </Card>
    </div>
  )
}
