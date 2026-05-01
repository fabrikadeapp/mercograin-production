'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'

interface Boleto {
  id: string
  numero: string
  banco: string
  valor: string
  vencimento: string
  status: 'aberto' | 'pago' | 'vencido' | 'cancelado'
  linkBoleto?: string
  cliente: {
    id: string
    nome: string
  }
  criadoEm: string
}

interface PaginatedResponse {
  data: Boleto[]
  total: number
  page: number
  limit: number
  pages: number
}

export default function BoletosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { success, error: showError } = useToast()

  const [boletos, setBoletos] = useState<Boleto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [banco, setBanco] = useState(searchParams.get('banco') || '')
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'))
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const limit = 25

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchBoletos()
    }
  }, [status, router])

  useEffect(() => {
    const params = new URLSearchParams()
    if (page) params.set('page', page.toString())
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    if (banco) params.set('banco', banco)

    router.push(`/boletos?${params.toString()}`, { scroll: false })
  }, [page, search, statusFilter, banco, router])

  const fetchBoletos = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', limit.toString())
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (banco) params.set('banco', banco)

      const response = await fetch(`/api/boletos?${params.toString()}`)
      if (!response.ok) throw new Error('Erro ao buscar boletos')

      const data: PaginatedResponse = await response.json()
      setBoletos(data.data)
      setTotal(data.total)
      setPages(data.pages)
    } catch (err) {
      showError('Erro ao carregar boletos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchBoletos()
    }, 300)

    return () => clearTimeout(timer)
  }, [search, statusFilter, banco])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)

      const response = await fetch(`/api/boletos/export?${params.toString()}`)
      if (!response.ok) throw new Error('Erro ao exportar')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Boletos-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      success('Excel exportado com sucesso!')
    } catch (err) {
      showError('Erro ao exportar Excel')
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">💰 Boletos</h1>
              <p className="text-gray-600 mt-1">Gerencie cobranças e boletos de clientes</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleExportExcel}
                disabled={loading || boletos.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
              >
                📊 Exportar Excel
              </button>
              <Link href="/boletos/novo">
                <Button variant="primary">+ Novo Boleto</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filters */}
        <Card className="mb-6" variant="elevated">
          <CardContent className="p-4 space-y-4">
            <SearchInput
              onSearch={setSearch}
              placeholder="🔍 Buscar por número ou cliente..."
            />

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden text-sm text-blue-600 font-medium hover:text-blue-700"
            >
              {showFilters ? '✕ Fechar Filtros' : '⚙️ Mostrar Filtros'}
            </button>

            <div className={`${showFilters ? 'block' : 'hidden md:block'} grid grid-cols-1 sm:grid-cols-2 gap-4`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os status</option>
                  <option value="aberto">Aberto</option>
                  <option value="pago">Pago</option>
                  <option value="vencido">Vencido</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Banco</label>
                <select
                  value={banco}
                  onChange={(e) => {
                    setBanco(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os bancos</option>
                  <option value="Itaú">Itaú</option>
                  <option value="Bradesco">Bradesco</option>
                  <option value="Santander">Santander</option>
                  <option value="Caixa">Caixa</option>
                  <option value="Sicredi">Sicredi</option>
                  <option value="Nu Bank">Nu Bank</option>
                  <option value="C6 Bank">C6 Bank</option>
                </select>
              </div>
            </div>

            {(search || statusFilter || banco) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-600">Filtros ativos:</span>
                {search && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {search} ✕
                  </span>
                )}
                {statusFilter && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {statusFilter} ✕
                  </span>
                )}
                {banco && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {banco} ✕
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Info */}
        {!loading && (
          <div className="text-sm text-gray-600 mb-4">
            {total > 0 ? (
              <span>
                Mostrando <strong>{boletos.length}</strong> de <strong>{total}</strong> boletos
                {pages > 1 && ` • Página ${page} de ${pages}`}
              </span>
            ) : (
              <span>Nenhum boleto encontrado</span>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => (
              <Card key={i} variant="elevated">
                <CardContent className="p-4">
                  <Skeleton variant="text" className="mb-2 w-full" />
                  <Skeleton variant="text" className="w-4/5" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : boletos.length === 0 ? (
          <Card variant="elevated">
            <CardContent className="py-12">
              <EmptyState
                icon="💰"
                title="Nenhum boleto criado"
                description={search || statusFilter || banco ? 'Tente ajustar seus filtros' : 'Comece criando seu primeiro boleto a partir de um contrato'}
                action={{
                  label: 'Novo Boleto',
                  onClick: () => router.push('/boletos/novo'),
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4">
              {boletos.map((boleto) => (
                <Link key={boleto.id} href={`/boletos/${boleto.id}`}>
                  <Card variant="elevated" className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-bold text-gray-900">BOL-{boleto.numero}</h3>
                            <StatusBadge status={boleto.status} />
                          </div>
                          <p className="text-sm text-gray-600">{boleto.cliente.nome}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">{formatCurrency(parseFloat(boleto.valor))}</p>
                          <p className="text-xs text-gray-500">Banco: {boleto.banco}</p>
                        </div>
                      </div>

                      <div className="border-t pt-3 flex justify-between text-xs text-gray-600 mb-3">
                        <span>Criado em: {formatDate(boleto.criadoEm)}</span>
                        <span>Vencimento: {formatDate(boleto.vencimento)}</span>
                      </div>

                      {boleto.linkBoleto && (
                        <a href={boleto.linkBoleto} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs font-medium hover:underline">
                          📥 Baixar Boleto
                        </a>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="mt-6 flex justify-center">
                <Pagination
                  currentPage={page}
                  totalPages={pages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
