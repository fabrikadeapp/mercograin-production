'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Filter,
  Download,
  ListChecks,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  List,
  LayoutGrid,
} from 'lucide-react'
import { PropostasKanban } from './_components/PropostasKanban'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Chip,
  Badge,
  Select,
  SearchField,
  type BadgeStatus,
} from '@/components/ui/phb'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'

interface Proposta {
  id: string
  numero: string
  tipo: 'venda' | 'compra'
  status: string
  valorTotal: string
  validadeEm: string
  criadaEm: string
  cliente: {
    id: string
    nome: string
  }
  /** JSON serializado dos grãos da proposta (para extrair qtd/commodity no Kanban) */
  graos?: unknown
  scoreInterno?: number | null
}

type ViewMode = 'list' | 'kanban'

interface GraoItem {
  grao?: string
  commodity?: string
  quantidade?: number
  quantidadeSc?: number
}

function extractKanbanFields(p: Proposta): {
  quantidadeSc: number | null
  commodity: string | null
} {
  const arr = Array.isArray(p.graos) ? (p.graos as GraoItem[]) : []
  if (arr.length === 0) return { quantidadeSc: null, commodity: null }
  // Quantidade total em sacas (somatório se múltiplos grãos)
  const qtd = arr.reduce((acc, g) => {
    const v = g.quantidadeSc ?? g.quantidade ?? 0
    return acc + (typeof v === 'number' ? v : 0)
  }, 0)
  const c = arr[0]?.commodity ?? arr[0]?.grao ?? null
  return {
    quantidadeSc: qtd > 0 ? qtd : null,
    commodity: c ? String(c).charAt(0).toUpperCase() + String(c).slice(1) : null,
  }
}

interface PaginatedResponse {
  data: Proposta[]
  total: number
  page: number
  limit: number
  pages: number
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'enviada', label: 'Enviada' },
  { value: 'aceita', label: 'Aceita' },
  { value: 'rejeitada', label: 'Rejeitada' },
]

// Mapeia status do banco para variantes do Badge.
// Status legados/variações do banco também caem em algo razoável (não quebram).
const STATUS_TO_BADGE: Record<string, BadgeStatus> = {
  rascunho: 'rascunho',
  enviada: 'pendente',
  em_negociacao: 'em-negociacao',
  'em negociação': 'em-negociacao',
  aceita: 'assinado',
  aprovada: 'assinado',
  rejeitada: 'cancelado',
  recusada: 'cancelado',
  expirada: 'cancelado',
  fechado: 'fechado',
  sucesso: 'assinado',
}

export default function PropostasPage() {
  const { status } = useSession()
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
  const [view, setView] = useState<ViewMode>('list')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('bhg-propostas-view')
      if (stored === 'kanban' || stored === 'list') setView(stored)
    } catch {
      /* ignore */
    }
  }, [])

  const applyView = (v: ViewMode) => {
    setView(v)
    try {
      window.localStorage.setItem('bhg-propostas-view', v)
    } catch {
      /* ignore */
    }
  }

  // Kanban precisa de todas as propostas (não 25 por página) para distribuir
  // corretamente entre as 5 colunas.
  const limit = view === 'kanban' ? 200 : 25

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') fetchPropostas()
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

  // Refetch ao trocar de view (limit muda)
  useEffect(() => {
    if (status === 'authenticated') {
      fetchPropostas()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

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
    <AppShell>
      <PageHeader
        eyebrow={loading ? 'Comercial · Carregando…' : `Comercial · ${total} proposta${total === 1 ? '' : 's'}`}
        title="Propostas"
        subtitle="Acompanhe propostas comerciais em todos os estágios."
        search={false}
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={handleExportExcel}
              disabled={loading || propostas.length === 0}
            >
              Exportar Excel
            </Button>
            <Link href="/propostas/nova">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Nova proposta</Button>
            </Link>
          </>
        }
      />

      <Card className="mb-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchField
            placeholder="Buscar por número ou cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            containerClassName="flex-1 min-w-[260px]"
          />
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            containerClassName="w-56"
          />

          {/* Toggle Lista / Kanban */}
          <div
            className="inline-flex items-center gap-0.5"
            style={{
              padding: 3,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 999,
            }}
            role="group"
            aria-label="Visualização"
          >
            <button
              type="button"
              onClick={() => applyView('list')}
              aria-pressed={view === 'list'}
              title="Visualização em lista"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: view === 'list' ? 600 : 400,
                background: view === 'list' ? 'var(--surface-1)' : 'transparent',
                color: view === 'list' ? 'var(--text)' : 'var(--text-mute)',
                boxShadow: view === 'list' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                transition: '120ms ease',
              }}
            >
              <List className="h-3.5 w-3.5" />
              Lista
            </button>
            <button
              type="button"
              onClick={() => applyView('kanban')}
              aria-pressed={view === 'kanban'}
              title="Visualização em kanban por status"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: view === 'kanban' ? 600 : 400,
                background: view === 'kanban' ? 'var(--surface-1)' : 'transparent',
                color: view === 'kanban' ? 'var(--text)' : 'var(--text-mute)',
                boxShadow: view === 'kanban' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                transition: '120ms ease',
              }}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </button>
          </div>
        </div>

        {(search || statusFilter) && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border-1">
            <span className="eyebrow flex items-center gap-1.5">
              <Filter className="h-3 w-3" /> Filtros ativos
            </span>
            {search && (
              <Chip variant="info" className="cursor-pointer" onClick={() => setSearch('')}>
                {search} <X className="h-3 w-3 ml-1" />
              </Chip>
            )}
            {statusFilter && (
              <Chip variant="info" className="cursor-pointer" onClick={() => setStatusFilter('')}>
                {statusFilter} <X className="h-3 w-3 ml-1" />
              </Chip>
            )}
          </div>
        )}
      </Card>

      {!loading && total > 0 && (
        <p className="text-fg-3 text-small mb-4">
          Mostrando <span className="text-fg-1 t-num">{propostas.length}</span> de{' '}
          <span className="text-fg-1 t-num">{total}</span> propostas
          {pages > 1 && (
            <>
              {' '}
              · Página <span className="text-fg-1 t-num">{page}</span> de{' '}
              <span className="text-fg-1 t-num">{pages}</span>
            </>
          )}
        </p>
      )}

      {loading ? (
        <Card className="text-center py-16 text-fg-3 text-small">Carregando…</Card>
      ) : propostas.length === 0 ? (
        <Card className="text-center py-16 space-y-3">
          <ListChecks className="h-8 w-8 text-fg-3 mx-auto" />
          <p className="eyebrow">Vazio</p>
          <h3 className="text-h3 font-sans tracking-tight text-fg-1">
            Nenhuma proposta encontrada
          </h3>
          <p className="text-fg-2 text-body">
            {search || statusFilter
              ? 'Tente ajustar seus filtros.'
              : 'Comece criando sua primeira proposta.'}
          </p>
          <div className="pt-2">
            <Link href="/propostas/nova">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Nova proposta</Button>
            </Link>
          </div>
        </Card>
      ) : view === 'kanban' ? (
        <PropostasKanban
          propostas={propostas.map((p) => {
            const { quantidadeSc, commodity } = extractKanbanFields(p)
            return {
              id: p.id,
              numero: p.numero,
              status: p.status,
              valorTotal: p.valorTotal,
              cliente: p.cliente,
              quantidadeSc,
              commodity,
              scoreInterno: p.scoreInterno ?? null,
            }
          })}
        />
      ) : (
        <>
          <div className="space-y-3">
            {propostas.map((proposta) => {
              const TipoIcon = proposta.tipo === 'venda' ? ArrowUpRight : ArrowDownLeft
              return (
                <Link key={proposta.id} href={`/propostas/${proposta.id}`}>
                  <Card className="hover:bg-bg-3 transition-colors cursor-pointer">
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="text-fg-1 font-semibold t-num">{proposta.numero}</h3>
                          <Badge variant={STATUS_TO_BADGE[proposta.status]} />
                        </div>
                        <p className="text-fg-2 text-small truncate">{proposta.cliente.nome}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="t-num-lg text-fg-1">
                          {formatCurrency(parseFloat(proposta.valorTotal))}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border-1">
                      <div>
                        <p className="eyebrow">Tipo</p>
                        <p className="text-fg-1 text-small flex items-center gap-1.5 mt-1">
                          <TipoIcon
                            className={`h-3.5 w-3.5 ${
                              proposta.tipo === 'venda' ? 'text-pos' : 'text-info'
                            }`}
                          />
                          {proposta.tipo === 'venda' ? 'Venda' : 'Compra'}
                        </p>
                      </div>
                      <div>
                        <p className="eyebrow">Criada em</p>
                        <p className="text-fg-2 text-small t-num mt-1">
                          {formatDate(proposta.criadaEm)}
                        </p>
                      </div>
                      <div>
                        <p className="eyebrow">Validade</p>
                        <p className="text-fg-2 text-small t-num mt-1">
                          {formatDate(proposta.validadeEm)}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>

          {pages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination currentPage={page} totalPages={pages} onPageChange={handlePageChange} />
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
