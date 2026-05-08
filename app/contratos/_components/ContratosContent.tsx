'use client'
import * as React from 'react'
import { Download, MoreHorizontal } from 'lucide-react'
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
  type DenseTableColumn,
} from '@/components/ui/phb'
import { PIPELINE_STAGES, CONTRACTS, type ContractRow } from '@/lib/mocks/phb'

const FILTERS = [
  { value: 'todos', label: 'Todos', count: 312 },
  { value: 'soja', label: 'Soja', count: 168 },
  { value: 'milho', label: 'Milho', count: 92 },
  { value: 'trigo', label: 'Trigo', count: 38 },
  { value: 'outros', label: 'Outros', count: 14 },
]

export function ContratosContent() {
  const [filter, setFilter] = React.useState('todos')

  const cols: DenseTableColumn<ContractRow>[] = [
    {
      key: 'numero',
      header: 'CONTRATO',
      accessor: (r) => <span className="t-num text-fg-1">{r.numero}</span>,
    },
    {
      key: 'cliente',
      header: 'CLIENTE',
      accessor: (r) => <span className="text-fg-1">{r.cliente}</span>,
    },
    {
      key: 'grao',
      header: 'GRÃO',
      accessor: (r) => <GrainBadge variant={r.grao} />,
    },
    {
      key: 'volume',
      header: 'VOLUME (SC)',
      accessor: (r) => <span className="t-num">{r.volume}</span>,
      align: 'right',
      isNumeric: true,
    },
    {
      key: 'preco',
      header: 'PREÇO (R$)',
      accessor: (r) => <span className="t-num">{r.preco}</span>,
      align: 'right',
      isNumeric: true,
    },
    {
      key: 'total',
      header: 'TOTAL (R$)',
      accessor: (r) => <span className="t-num text-fg-1">{r.total}</span>,
      align: 'right',
      isNumeric: true,
    },
    {
      key: 'vence',
      header: 'VENCE',
      accessor: (r) => <span className="text-fg-2 text-small">{r.vence}</span>,
    },
    {
      key: 'status',
      header: 'STATUS',
      accessor: (r) => <Badge variant={r.status} />,
    },
    {
      key: 'actions',
      header: '',
      accessor: () => (
        <IconButton aria-label="Mais ações">
          <MoreHorizontal className="h-4 w-4" />
        </IconButton>
      ),
      align: 'right',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {PIPELINE_STAGES.map((s) => (
          <PipelineStageCard key={s.stage} {...s} />
        ))}
      </div>

      <Card className="p-6">
        <CardHeader>
          <Tabs options={FILTERS} value={filter} onChange={setFilter} size="sm" />
          <div className="flex items-center gap-3">
            <Pill>Últimos 30 dias</Pill>
            <Button variant="ghost" leftIcon={<Download className="h-4 w-4" />}>
              CSV
            </Button>
          </div>
        </CardHeader>
        <DenseTable
          columns={cols}
          rows={CONTRACTS}
          rowKey={(r) => r.numero}
          className="!border-0 !shadow-none !bg-transparent"
        />
      </Card>
    </div>
  )
}
