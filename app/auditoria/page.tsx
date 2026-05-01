'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/contexts/ToastContext'
import { formatDate } from '@/lib/utils/formatters'

interface AuditLog {
  id: string
  userId: string
  acao: string
  entidade: string
  entidadeId: string
  mudancas?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  criadoEm: string
}

interface PaginatedResponse {
  data: AuditLog[]
  total: number
  page: number
  limit: number
  pages: number
}

const acaoEmojis: Record<string, string> = {
  criar: '✨',
  atualizar: '📝',
  deletar: '🗑️',
  visualizar: '👁️',
}

const entidadeEmojis: Record<string, string> = {
  cliente: '👥',
  proposta: '📄',
  contrato: '🤝',
  boleto: '💰',
}

const acaoCores: Record<string, string> = {
  criar: 'bg-green-100 text-green-800',
  atualizar: 'bg-blue-100 text-blue-800',
  deletar: 'bg-red-100 text-red-800',
  visualizar: 'bg-gray-100 text-gray-800',
}

export default function AuditoriaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { error: showError } = useToast()

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'))
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [entidadeFilter, setEntidadeFilter] = useState(searchParams.get('entidade') || '')
  const [acaoFilter, setAcaoFilter] = useState(searchParams.get('acao') || '')

  const limit = 50

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchLogs()
    }
  }, [status, router])

  useEffect(() => {
    const params = new URLSearchParams()
    if (page) params.set('page', page.toString())
    if (entidadeFilter) params.set('entidade', entidadeFilter)
    if (acaoFilter) params.set('acao', acaoFilter)

    router.push(`/auditoria?${params.toString()}`, { scroll: false })
  }, [page, entidadeFilter, acaoFilter, router])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', limit.toString())
      if (entidadeFilter) params.set('entidade', entidadeFilter)
      if (acaoFilter) params.set('acao', acaoFilter)

      const response = await fetch(`/api/auditoria?${params.toString()}`)
      if (!response.ok) throw new Error('Erro ao buscar logs')

      const data: PaginatedResponse = await response.json()
      setLogs(data.data)
      setTotal(data.total)
      setPages(data.pages)
    } catch (err) {
      showError('Erro ao carregar logs de auditoria')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">📋 Log de Auditoria</h1>
          <p className="text-gray-600 mt-2">Histórico de todas as ações realizadas no sistema</p>
        </div>

        {/* Filters */}
        <Card variant="elevated" className="mb-6">
          <CardContent className="p-4 space-y-4">
            <div>
              <button
                onClick={() => setPage(1)}
                className="text-sm text-blue-600 hover:underline mb-4"
              >
                🔄 Atualizar
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Entidade</label>
                  <select
                    value={entidadeFilter}
                    onChange={(e) => {
                      setEntidadeFilter(e.target.value)
                      setPage(1)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todas as entidades</option>
                    <option value="cliente">👥 Cliente</option>
                    <option value="proposta">📄 Proposta</option>
                    <option value="contrato">🤝 Contrato</option>
                    <option value="boleto">💰 Boleto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ação</label>
                  <select
                    value={acaoFilter}
                    onChange={(e) => {
                      setAcaoFilter(e.target.value)
                      setPage(1)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todas as ações</option>
                    <option value="criar">✨ Criar</option>
                    <option value="atualizar">📝 Atualizar</option>
                    <option value="deletar">🗑️ Deletar</option>
                    <option value="visualizar">👁️ Visualizar</option>
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Info */}
        {!loading && (
          <div className="text-sm text-gray-600 mb-4">
            {total > 0 ? (
              <span>
                Mostrando <strong>{logs.length}</strong> de <strong>{total}</strong> registros
                {pages > 1 && ` • Página ${page} de ${pages}`}
              </span>
            ) : (
              <span>Nenhum registro de auditoria encontrado</span>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="space-y-3">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <Card key={i} variant="elevated">
                  <CardContent className="p-4">
                    <Skeleton variant="text" className="mb-2 w-full" />
                    <Skeleton variant="text" className="w-3/4" />
                  </CardContent>
                </Card>
              ))}
          </div>
        ) : logs.length === 0 ? (
          <Card variant="elevated">
            <CardContent className="py-12">
              <div className="text-center">
                <p className="text-gray-600 mb-4">Nenhum registro de auditoria encontrado</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {logs.map((log) => (
                <Card key={log.id} variant="elevated">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Emoji da entidade */}
                      <div className="text-2xl">
                        {entidadeEmojis[log.entidade] || '📌'}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-semibold text-gray-900">
                            {log.entidade.charAt(0).toUpperCase() + log.entidade.slice(1)}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${acaoCores[log.acao] || 'bg-gray-100'}`}>
                            {acaoEmojis[log.acao]} {log.acao}
                          </span>
                          <span className="text-sm text-gray-500">ID: {log.entidadeId.substring(0, 8)}</span>
                        </div>

                        {log.mudancas && Object.keys(log.mudancas).length > 0 && (
                          <div className="bg-gray-50 rounded p-2 mb-2 text-xs text-gray-700">
                            <p className="font-medium mb-1">Alterações:</p>
                            <ul className="space-y-1">
                              {Object.entries(log.mudancas).map(([key, value]) => (
                                <li key={key}>
                                  <strong>{key}:</strong> {JSON.stringify(value)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{formatDate(new Date(log.criadoEm))}</span>
                          {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
