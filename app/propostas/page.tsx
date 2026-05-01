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

interface Proposta {
  id: string
  numero: string
  tipo: 'venda' | 'compra'
  status: 'rascunho' | 'enviada' | 'aceita' | 'rejeitada'
  valorTotal: string
  validadeEm: string
  criadaEm: string
  cliente: {
    id: string
    nome: string
  }
}

interface PaginatedResponse {
  data: Proposta[]
  total: number
  page: number
  limit: number
  pages: number
}

export default function PropostasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { success, error: showError } = useToast()

  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
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
      fetchPropostas()
    }
  }, [status, router])

  useEffect(() => {
    const params = new URLSearchParams()
    if (page) params.set('page', page.toString())
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)

    router.push(`/propostas?${params.toString()}`, { scroll: false })
  }, [page, search, statusFilter, router])

  const fetchPropostas = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', limit.toString())
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)

      const response = await fetch(`/api/propostas?${params.toString()}`)
      if (!response.ok) throw new Error('Erro ao buscar propostas')

      const data: PaginatedResponse = await response.json()
      setPropostas(data.data)
      setTotal(data.total)
      setPages(data.pages)
    } catch (err) {
      showError('Erro ao carregar propostas')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchPropostas()
    }, 300)

    return () => clearTimeout(timer)
  }, [search, statusFilter])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)

      const response = await fetch(`/api/propostas/export?${params.toString()}`)
      if (!response.ok) throw new Error('Erro ao exportar')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Propostas-${new Date().toISOString().split('T')[0]}.xlsx`
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
              <h1 className="text-3xl font-bold text-gray-900">📋 Propostas</h1>
              <p className="text-gray-600 mt-1">Gerencie suas propostas comerciais</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleExportExcel}
                disabled={loading || propostas.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
              >
                📊 Exportar Excel
              </button>
              <Link href="/propostas/nova">
                <Button variant="primary">+ Nova Proposta</Button>
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
                  <option value="rascunho">Rascunho</option>
                  <option value="enviada">Enviada</option>
                  <option value="aceita">Aceita</option>
                  <option value="rejeitada">Rejeitada</option>
                </select>
              </div>
            </div>

            {(search || statusFilter) && (
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Info */}
        {!loading && (
          <div className="text-sm text-gray-600 mb-4">
            {total > 0 ? (
              <span>
                Mostrando <strong>{propostas.length}</strong> de <strong>{total}</strong> propostas
                {pages > 1 && ` • Página ${page} de ${pages}`}
              </span>
            ) : (
              <span>Nenhuma proposta encontrada</span>
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
        ) : propostas.length === 0 ? (
          <Card variant="elevated">
            <CardContent className="py-12">
              <EmptyState
                icon="📋"
                title="Nenhuma proposta encontrada"
                description={search || statusFilter ? 'Tente ajustar seus filtros' : 'Comece criando sua primeira proposta'}
                action={{
                  label: 'Nova Proposta',
                  onClick: () => router.push('/propostas/nova'),
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4">
              {propostas.map((proposta) => (
                <Link key={proposta.id} href={`/propostas/${proposta.id}`}>
                  <Card variant="elevated" className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-gray-900">PROP-{proposta.numero}</h3>
                          <p className="text-sm text-gray-600">{proposta.cliente.nome}</p>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={proposta.status} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t">
                        <div>
                          <p className="text-xs text-gray-600">Tipo</p>
                          <p className="text-sm font-medium text-gray-900">
                            {proposta.tipo === 'venda' ? '📤 Venda' : '📥 Compra'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Valor</p>
                          <p className="text-sm font-bold text-green-600">{formatCurrency(parseFloat(proposta.valorTotal))}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Criada em</p>
                          <p className="text-sm text-gray-600">{formatDate(proposta.criadaEm)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Validade</p>
                          <p className="text-sm text-gray-600">{formatDate(proposta.validadeEm)}</p>
                        </div>
                      </div>
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
