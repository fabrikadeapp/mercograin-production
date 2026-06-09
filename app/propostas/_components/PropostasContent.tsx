'use client'

/**
 * Propostas — mesmo design da página de Contratos (cards de etapa + tabela),
 * SEM Kanban (o Kanban vive em /propostas/kanban). Mostra só propostas que
 * ainda NÃO viraram contrato. Propostas perdidas/recusadas aparecem riscadas,
 * em tom levemente avermelhado.
 */
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

const FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
  { value: 'outros', label: 'Outros' },
]

interface PropostaRow {
  id: string
  numero: string
  cliente: string
  grao: string
  volume: string
  preco: string
  total: string
  vence: string
  status: string
  /** true = não virou negócio (recusada/perdida/cancelada/expirada) → riscada. */
  perdida: boolean
}

async function safeJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json()
}

function statusToVariant(s: string): string {
  const x = (s || '').toLowerCase()
  if (/aceita|aprovada|sucesso|fechado/.test(x)) return 'fechado'
  if (/enviada/.test(x)) return 'em-negociacao'
  if (/negocia/.test(x)) return 'em-negociacao'
  if (/recusada|rejeitada|expirada|cancelad|perdida/.test(x)) return 'cancelado'
  return 'rascunho'
}
function ehPerdida(s: string): boolean {
  return /recusada|rejeitada|expirada|cancelad|perdida/.test((s || '').toLowerCase())
}
function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function PropostasContent() {
  const router = useRouter()
  const [filter, setFilter] = React.useState('todos')
  const [funil, setFunil] = React.useState<{ items: any[] } | null>(null)
  const [propostas, setPropostas] = React.useState<any[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancel = false
    Promise.all([
      safeJson('/api/propostas/funil').catch(() => null),
      safeJson('/api/propostas?limit=25').catch(() => null),
    ])
      .then(([f, p]) => {
        if (cancel) return
        setFunil(f)
        setPropostas(p?.data || [])
      })
      .catch((e) => !cancel && setError(String(e)))
    return () => { cancel = true }
  }, [])

  if (error) return <ErrorBanner message={error} />

  const stages = funil?.items || []
  const rows: PropostaRow[] = (propostas || []).map((p: any) => {
    const grainArr = Array.isArray(p?.graos) ? p.graos : []
    const firstGrao = (grainArr[0]?.grao || grainArr[0]?.commodity || 'soja').toLowerCase()
    const totalSc = grainArr.reduce((s: number, g: any) => s + Number(g?.quantidade ?? g?.quantidadeSc ?? 0), 0)
    const valor = Number(p?.valorTotal || 0)
    const preco = totalSc > 0 ? valor / totalSc : 0
    return {
      id: p.id,
      numero: p.numero,
      cliente: p?.cliente?.nome || '—',
      grao: firstGrao,
      volume: totalSc.toLocaleString('pt-BR'),
      preco: preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      total: valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      vence: p.validadeEm ? fmtDate(p.validadeEm) : '—',
      status: statusToVariant(p.status),
      perdida: ehPerdida(p.status),
    }
  })

  const filtered = filter === 'todos' ? rows : rows.filter((r) => r.grao === filter || (filter === 'outros' && !['soja', 'milho', 'trigo'].includes(r.grao)))

  // Célula com aparência de "perdida": riscada + leve tom avermelhado.
  const cell = (r: PropostaRow, node: React.ReactNode) =>
    r.perdida ? <span className="text-[var(--danger)] line-through opacity-80">{node}</span> : node

  const cols: DenseTableColumn<PropostaRow>[] = [
    { key: 'numero', header: 'PROPOSTA', accessor: (r) => <span className="t-num text-fg-1">{cell(r, r.numero)}</span> },
    { key: 'cliente', header: 'CLIENTE', accessor: (r) => <span className="text-fg-1">{cell(r, r.cliente)}</span> },
    { key: 'grao', header: 'GRÃO', accessor: (r) => r.perdida ? <span className="opacity-60"><GrainBadge variant={r.grao as any} /></span> : <GrainBadge variant={r.grao as any} /> },
    { key: 'volume', header: 'VOLUME (SC)', accessor: (r) => <span className="t-num">{cell(r, r.volume)}</span>, align: 'right', isNumeric: true },
    { key: 'preco', header: 'PREÇO (R$)', accessor: (r) => <span className="t-num">{cell(r, r.preco)}</span>, align: 'right', isNumeric: true },
    { key: 'total', header: 'TOTAL (R$)', accessor: (r) => <span className="t-num text-fg-1">{cell(r, r.total)}</span>, align: 'right', isNumeric: true },
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
      {/* cards de etapa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {!funil
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={120} />)
          : stages.map((s: any) => (
              <PipelineStageCard key={s.stage} stage={s.stage} count={s.count} percent={s.percent} total={s.total} color={s.color} />
            ))}
      </div>

      {/* tabela */}
      <Card className="p-6">
        <CardHeader>
          <Tabs options={FILTERS} value={filter} onChange={setFilter} size="sm" />
          <div className="flex items-center gap-3">
            <Pill>Últimos 30 dias</Pill>
            <a href="/api/propostas/export" className="inline-flex">
              <Button variant="ghost" leftIcon={<Download className="h-4 w-4" />}>CSV</Button>
            </a>
          </div>
        </CardHeader>
        {!propostas ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={36} />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Inbox} title="Sem propostas" description="As propostas que ainda não viraram negócio aparecem aqui. Crie a primeira." />
        ) : (
          <DenseTable
            columns={cols}
            rows={filtered}
            rowKey={(r) => r.numero}
            onRowClick={(r) => { if (r.id) router.push(`/propostas/${r.id}`) }}
            className="!border-0 !shadow-none !bg-transparent"
          />
        )}
      </Card>
    </div>
  )
}
