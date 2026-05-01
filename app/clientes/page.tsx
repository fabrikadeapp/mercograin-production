'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/contexts/ToastContext'
import { formatDate } from '@/lib/utils/formatters'

interface Cliente {
  id: string
  nome: string
  email?: string
  telefone?: string
  tipo: 'comprador' | 'vendedor' | 'ambos'
  ativo: boolean
  criadaEm: string
}

interface PaginatedResponse {
  data: Cliente[]
  total: number
  page: number
  limit: number
  pages: number
}

export default function ClientesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { success, error: showError } = useToast()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [tipo, setTipo] = useState(searchParams.get('tipo') || '')
  const [ativo, setAtivo] = useState(searchParams.get('ativo') || '')
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
      fetchClientes()
    }
  }, [status, router])

  useEffect(() => {
    // Atualizar URL quando params mudam
    const params = new URLSearchParams()
    if (page) params.set('page', page.toString())
    if (search) params.set('search', search)
    if (tipo) params.set('tipo', tipo)
    if (ativo) params.set('ativo', ativo)

    router.push(`/clientes?${params.toString()}`, { scroll: false })
  }, [page, search, tipo, ativo, router])

  const fetchClientes = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', limit.toString())
      if (search) params.set('search', search)
      if (tipo) params.set('tipo', tipo)
      if (ativo) params.set('ativo', ativo)

      const response = await fetch(`/api/clientes?${params.toString()}`)
      if (!response.ok) throw new Error('Erro ao buscar clientes')

      const data: PaginatedResponse = await response.json()
      setClientes(data.data)
      setTotal(data.total)
      setPages(data.pages)
    } catch (err) {
      showError('Erro ao carregar clientes')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchClientes()
    }, 300)

    return () => clearTimeout(timer)
  }, [search, tipo, ativo])

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Deseja deletar o cliente "${nome}"?`)) return

    try {
      const response = await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erro ao deletar')

      setClientes(clientes.filter((c) => c.id !== id))
      success('Cliente deletado com sucesso')
    } catch (err) {
      showError('Erro ao deletar cliente')
    }
  }

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
              <h1 className="text-3xl font-bold text-gray-900">👥 Clientes</h1>
              <p className="text-gray-600 mt-1">Gerencie seus clientes e parceiros comerciais</p>
            </div>
            <Link href="/clientes/novo">
              <Button variant="primary">+ Novo Cliente</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filters */}
        <Card className="mb-6" variant="elevated">
          <CardContent className="p-4 space-y-4">
            {/* Search */}
            <SearchInput
              onSearch={setSearch}
              placeholder="🔍 Buscar por nome, email ou CNPJ..."
            />

            {/* Filter Toggle (Mobile) */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden text-sm text-blue-600 font-medium hover:text-blue-700"
            >
              {showFilters ? '✕ Fechar Filtros' : '⚙️ Mostrar Filtros'}
            </button>

            {/* Filters (Desktop always visible, Mobile toggle) */}
            <div className={`${showFilters ? 'block' : 'hidden md:block'} grid grid-cols-1 sm:grid-cols-2 gap-4`}>
              {/* Tipo Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                <select
                  value={tipo}
                  onChange={(e) => {
                    setTipo(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os tipos</option>
                  <option value="comprador">Comprador</option>
                  <option value="vendedor">Vendedor</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>

              {/* Ativo Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={ativo}
                  onChange={(e) => {
                    setAtivo(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os status</option>
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>
            </div>

            {/* Filtros Ativos Badge */}
            {(search || tipo || ativo) && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-600">Filtros ativos:</span>
                {search && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {search} ✕
                  </span>
                )}
                {tipo && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {tipo} ✕
                  </span>
                )}
                {ativo && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {ativo === 'true' ? 'Ativo' : 'Inativo'} ✕
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
                Mostrando <strong>{clientes.length}</strong> de <strong>{total}</strong> clientes
                {pages > 1 && ` • Página ${page} de ${pages}`}
              </span>
            ) : (
              <span>Nenhum cliente encontrado</span>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <Card variant="elevated">
            <CardContent className="p-0">
              <div className="hidden md:block">
                <div className="border-b">
                  <div className="grid grid-cols-7 gap-4 p-4">
                    {Array(7).fill(0).map((_, i) => (
                      <Skeleton key={i} variant="text" className="w-full" />
                    ))}
                  </div>
                </div>
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="border-b">
                    <div className="grid grid-cols-7 gap-4 p-4">
                      {Array(7).fill(0).map((_, j) => (
                        <Skeleton key={j} variant="text" className="w-full" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="md:hidden space-y-3 p-4">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <Skeleton variant="text" className="mb-2 w-full" />
                    <Skeleton variant="text" className="w-4/5" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : clientes.length === 0 ? (
          <Card variant="elevated">
            <CardContent className="py-12">
              <EmptyState
                icon="👥"
                title="Nenhum cliente encontrado"
                description={search || tipo || ativo ? 'Tente ajustar seus filtros' : 'Comece adicionando seu primeiro cliente'}
                action={{
                  label: 'Novo Cliente',
                  onClick: () => router.push('/clientes/novo'),
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card variant="elevated">
              <CardContent className="p-0">
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHead>
                      <TableRow isHeader>
                        <TableHeaderCell>Nome</TableHeaderCell>
                        <TableHeaderCell>Email</TableHeaderCell>
                        <TableHeaderCell>Telefone</TableHeaderCell>
                        <TableHeaderCell>Tipo</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                        <TableHeaderCell>Criado em</TableHeaderCell>
                        <TableHeaderCell className="text-right">Ações</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {clientes.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell className="font-semibold">{cliente.nome}</TableCell>
                          <TableCell className="text-sm">{cliente.email || '-'}</TableCell>
                          <TableCell className="text-sm">{cliente.telefone || '-'}</TableCell>
                          <TableCell>
                            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {cliente.tipo === 'ambos' ? 'Comprador/Vendedor' : cliente.tipo}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={cliente.ativo ? 'ativo' : 'inativo'} />
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(cliente.criadaEm)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Link href={`/clientes/${cliente.id}/editar`}>
                                <Button variant="secondary" size="sm">
                                  Editar
                                </Button>
                              </Link>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDelete(cliente.id, cliente.nome)}
                              >
                                Deletar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden space-y-3 p-4">
                  {clientes.map((cliente) => (
                    <div key={cliente.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{cliente.nome}</h3>
                          <p className="text-xs text-gray-600 mt-1">
                            {cliente.tipo === 'ambos' ? 'Comprador/Vendedor' : cliente.tipo}
                          </p>
                        </div>
                        <StatusBadge status={cliente.ativo ? 'ativo' : 'inativo'} />
                      </div>

                      {cliente.email && <p className="text-xs text-gray-600 mb-1">📧 {cliente.email}</p>}
                      {cliente.telefone && <p className="text-xs text-gray-600 mb-2">📱 {cliente.telefone}</p>}
                      <p className="text-xs text-gray-500 mb-3">Criado em: {formatDate(cliente.criadaEm)}</p>

                      <div className="flex gap-2">
                        <Link href={`/clientes/${cliente.id}/editar`} className="flex-1">
                          <Button variant="secondary" size="sm" className="w-full">
                            Editar
                          </Button>
                        </Link>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(cliente.id, cliente.nome)}
                        >
                          Deletar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

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
