'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Input,
  Tabs,
  Chip,
  Pill,
  KPICard,
  DenseTable,
  type DenseTableColumn,
  type ChipVariant,
} from '@/components/ui/phb'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/contexts/ToastContext'
import { formatDateTime } from '@/lib/utils/formatters'

interface WebhookLog {
  id: string
  tipo: 'tradingview' | 'braspag' | 'signaturely'
  status: string
  payload: Record<string, unknown>
  mensagem?: string
  codigoErro?: string
  ipOrigem?: string
  criadoEm: string
  timestamp?: string
}

interface PaginatedResponse {
  data: WebhookLog[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

const TIPO_OPCOES = [
  { value: '', label: 'Todos' },
  { value: 'tradingview', label: 'TradingView' },
  { value: 'braspag', label: 'Braspag' },
  { value: 'signaturely', label: 'Signaturely' },
]

const STATUS_OPCOES = [
  { value: '', label: 'Todos' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'processado', label: 'Processado' },
  { value: 'erro', label: 'Erro' },
]

function statusToChipVariant(status: string): ChipVariant {
  switch (status) {
    case 'processado':
      return 'pos'
    case 'erro':
      return 'neg'
    case 'recebido':
      return 'info'
    case 'pendente':
      return 'warn'
    default:
      return 'neutral'
  }
}

function tipoLabel(tipo: string): string {
  return TIPO_OPCOES.find((o) => o.value === tipo)?.label || tipo
}

export default function WebhookLogsPage() {
  const { error: showError } = useToast()

  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)

  const [filters, setFilters] = useState({
    tipo: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  })

  useEffect(() => {
    fetchLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        ...(filters.tipo && { tipo: filters.tipo }),
        ...(filters.status && { status: filters.status }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
      })

      const response = await fetch(`/api/webhooks/logs?${params}`)
      if (!response.ok) throw new Error('Erro ao buscar logs')

      const data: PaginatedResponse = await response.json()
      setLogs(data.data)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (err) {
      showError('Erro ao carregar logs de webhooks')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {}
    const byTipo: Record<string, number> = {}
    for (const log of logs) {
      byStatus[log.status] = (byStatus[log.status] ?? 0) + 1
      byTipo[log.tipo] = (byTipo[log.tipo] ?? 0) + 1
    }
    return { byStatus, byTipo }
  }, [logs])

  const columns: DenseTableColumn<WebhookLog>[] = [
    {
      key: 'criadoEm',
      header: 'Timestamp',
      isNumeric: true,
      width: '200px',
      accessor: (row) => (
        <span className="font-mono tabular-nums text-fg-2 text-small whitespace-nowrap">
          {formatDateTime(new Date(row.criadoEm))}
        </span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      accessor: (row) => <Pill>{tipoLabel(row.tipo)}</Pill>,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row) => (
        <Chip variant={statusToChipVariant(row.status)}>
          {row.status[0]?.toUpperCase()}
          {row.status.slice(1)}
        </Chip>
      ),
    },
    {
      key: 'mensagem',
      header: 'Mensagem',
      accessor: (row) => {
        if (row.mensagem) {
          return <span className="text-fg-2 truncate block max-w-md">{row.mensagem}</span>
        }
        if (row.status === 'processado') {
          return (
            <span className="inline-flex items-center gap-1.5 text-fg-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-pos" />
              Sucesso
            </span>
          )
        }
        return (
          <span className="inline-flex items-center gap-1.5 text-fg-3">
            <AlertTriangle className="h-3.5 w-3.5 text-warn" />
            Sem mensagem
          </span>
        )
      },
    },
    {
      key: 'ipOrigem',
      header: 'IP origem',
      accessor: (row) => (
        <span className="font-mono tabular-nums text-fg-3 text-small">
          {row.ipOrigem || '—'}
        </span>
      ),
    },
  ]

  return (
    <AppShell>
      <PageHeader
        eyebrow="Integrações · Auditoria"
        title="Logs de Webhooks"
        subtitle={`${total} eventos · streaming ativo`}
        search={false}
        actions={
          <Link href="/api/webhooks/health">
            <Button variant="secondary" leftIcon={<Activity className="h-4 w-4" />}>
              Health Check
            </Button>
          </Link>
        }
      />

      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            eyebrow="Total"
            value={total.toLocaleString('pt-BR')}
            subtitle={`Página ${page} de ${Math.max(totalPages, 1)}`}
          />
          <KPICard
            eyebrow="Processados (página)"
            value={(stats.byStatus['processado'] ?? 0).toString()}
            highlightValue
          />
          <KPICard
            eyebrow="Erros (página)"
            value={(stats.byStatus['erro'] ?? 0).toString()}
          />
          <Card className="p-5 space-y-3">
            <p className="eyebrow">Health</p>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-pos" />
              <span className="text-fg-1 font-medium">Operacional</span>
            </div>
            <p className="text-fg-3 text-small">Últimos 30 dias sem incidentes</p>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1.5">
              <p className="eyebrow">Tipo</p>
              <Tabs
                size="sm"
                options={TIPO_OPCOES.map((o) => ({ value: o.value, label: o.label }))}
                value={filters.tipo}
                onChange={(v) => handleFilterChange('tipo', v)}
              />
            </div>
            <div className="space-y-1.5">
              <p className="eyebrow">Status</p>
              <Tabs
                size="sm"
                options={STATUS_OPCOES.map((o) => ({ value: o.value, label: o.label }))}
                value={filters.status}
                onChange={(v) => handleFilterChange('status', v)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="date"
              label="Data (de)"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
            <Input
              type="date"
              label="Data (até)"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
        </Card>

        {/* Tabela */}
        {loading ? (
          <Card className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <span className="text-fg-2 text-small">Carregando logs…</span>
          </Card>
        ) : (
          <>
            <DenseTable
              columns={columns}
              rows={logs}
              rowKey={(row) => row.id}
              empty="Nenhum log encontrado com os filtros aplicados"
            />

            {totalPages > 1 ? (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                isLoading={loading}
              />
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  )
}
