'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Pagination } from '@/components/ui/Pagination'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/contexts/ToastContext'
import { formatDate, formatDateTime } from '@/lib/utils/formatters'

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
  { value: 'tradingview', label: 'TradingView' },
  { value: 'braspag', label: 'Braspag' },
  { value: 'signaturely', label: 'Signaturely' },
]

const STATUS_OPCOES = [
  { value: 'recebido', label: 'Recebido' },
  { value: 'processado', label: 'Processado' },
  { value: 'erro', label: 'Erro' },
]

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
    search: '',
    dateFrom: '',
    dateTo: '',
  })

  useEffect(() => {
    fetchLogs()
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
    setPage(1) // Resetar para primeira página
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processado':
        return 'aceita'
      case 'erro':
        return 'rejeitada'
      case 'recebido':
        return 'enviada'
      default:
        return 'info'
    }
  }

  const getTipoLabel = (tipo: string) => {
    return TIPO_OPCOES.find((o) => o.value === tipo)?.label || tipo
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🔔 Logs de Webhooks</h1>
              <p className="text-gray-600 mt-1">Auditoria de webhooks recebidos</p>
            </div>
            <Link href="/api/webhooks/health">
              <Button variant="secondary">📊 Health Check</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros */}
        <Card variant="elevated" className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                <select
                  value={filters.tipo}
                  onChange={(e) => handleFilterChange('tipo', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  {TIPO_OPCOES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  {STATUS_OPCOES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data (De)</label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Data (Até)</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="max-w-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card variant="elevated">
            <CardContent className="py-4">
              <p className="text-sm text-gray-600 mb-1">Total de Webhooks</p>
              <p className="text-3xl font-bold text-gray-900">{total}</p>
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardContent className="py-4">
              <p className="text-sm text-gray-600 mb-1">Página</p>
              <p className="text-3xl font-bold text-gray-900">
                {page} / {totalPages}
              </p>
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardContent className="py-4">
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <p className="text-3xl font-bold text-green-600">✅ Operacional</p>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        {loading ? (
          <LoadingSpinner text="Carregando logs..." />
        ) : logs.length === 0 ? (
          <Card variant="elevated">
            <CardContent className="py-12 text-center">
              <p className="text-gray-600">Nenhum log encontrado com os filtros aplicados</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card variant="elevated" className="mb-8">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableRow isHeader>
                      <TableHeaderCell>Tipo</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Mensagem</TableHeaderCell>
                      <TableHeaderCell>IP Origem</TableHeaderCell>
                      <TableHeaderCell>Timestamp</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-semibold">{getTipoLabel(log.tipo)}</TableCell>
                        <TableCell>
                          <StatusBadge status={getStatusColor(log.status)} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.mensagem || (log.status === 'processado' ? '✅ Sucesso' : '⚠️ Sem mensagem')}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">{log.ipOrigem || '-'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDateTime(new Date(log.criadoEm))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              isLoading={loading}
            />
          </>
        )}
      </div>
    </div>
  )
}
