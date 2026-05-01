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
import { formatDate } from '@/lib/utils/formatters'

interface Contrato {
  id: string
  numero: string
  statusAssinatura: 'pendente' | 'assinado' | 'rejeitado'
  dataInicio: string
  dataFim?: string
  assinadoEm?: string
  criadoEm: string
  cliente: {
    id: string
    nome: string
  }
  pdfUrl?: string
}

interface PaginatedResponse {
  data: Contrato[]
  total: number
  page: number
  limit: number
  pages: number
}

export default function ContratosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { success, error: showError } = useToast()

  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('statusAssinatura') || '')
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
      fetchContratos()
    }
  }, [status, router])

  useEffect(() => {
    const params = new URLSearchParams()
    if (page) params.set('page', page.toString())
    if (search) params.set('search', search)
    if (statusFilter) params.set('statusAssinatura', statusFilter)

    router.push(`/contratos?${params.toString()}`, { scroll: false })
  }, [page, search, statusFilter, router])

  const fetchContratos = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', limit.toString())
      if (search) params.set('search', search)
      if (statusFilter) params.set('statusAssinatura', statusFilter)

      const response = await fetch(`/api/contratos?${params.toString()}`)
      if (!response.ok) throw new Error('Erro ao buscar contratos')

      const data: PaginatedResponse = await response.json()
      setContratos(data.data)
      setTotal(data.total)
      setPages(data.pages)
    } catch (err) {
      showError('Erro ao carregar contratos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchContratos()
    }, 300)

    return () => clearTimeout(timer)
  }, [search, statusFilter])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📝 Contratos</h1>
              <p className="text-gray-600 mt-1">Gerencie seus contratos e assinaturas</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Status de Assinatura</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os status</option>
                  <option value="pendente">Pendente</option>
                  <option value="assinado">Assinado</option>
                  <option value="rejeitado">Rejeitado</option>
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
                Mostrando <strong>{contratos.length}</strong> de <strong>{total}</strong> contratos
                {pages > 1 && ` • Página ${page} de ${pages}`}
              </span>
            ) : (
              <span>Nenhum contrato encontrado</span>
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
        ) : contratos.length === 0 ? (
          <Card variant="elevated">
            <CardContent className="py-12">
              <EmptyState
                icon="📝"
                title="Nenhum contrato encontrado"
                description={search || statusFilter ? 'Tente ajustar seus filtros' : 'Contratos serão criados a partir de propostas aceitas'}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4">
              {contratos.map((contrato) => (
                <Link key={contrato.id} href={`/contratos/${contrato.id}`}>
                  <Card variant="elevated" className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-gray-900">CTR-{contrato.numero}</h3>
                          <p className="text-sm text-gray-600">{contrato.cliente.nome}</p>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={contrato.statusAssinatura} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t">
                        <div>
                          <p className="text-xs text-gray-600">Início</p>
                          <p className="text-sm text-gray-900">{formatDate(contrato.dataInicio)}</p>
                        </div>
                        {contrato.dataFim && (
                          <div>
                            <p className="text-xs text-gray-600">Término</p>
                            <p className="text-sm text-gray-900">{formatDate(contrato.dataFim)}</p>
                          </div>
                        )}
                        {contrato.assinadoEm && (
                          <div>
                            <p className="text-xs text-gray-600">Assinado em</p>
                            <p className="text-sm font-medium text-green-600">{formatDate(contrato.assinadoEm)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-600">Criado em</p>
                          <p className="text-sm text-gray-600">{formatDate(contrato.criadoEm)}</p>
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
