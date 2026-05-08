'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Filter, Download, Wallet, ExternalLink, X } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Chip,
  Select,
  SearchField,
} from '@/components/ui/phb'
import { Pagination } from '@/components/ui/Pagination'
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

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'aberto', label: 'Aberto' },
  { value: 'pago', label: 'Pago' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'cancelado', label: 'Cancelado' },
]

const BANCOS_OPTIONS = [
  { value: '', label: 'Todos os bancos' },
  { value: 'Itaú', label: 'Itaú' },
  { value: 'Bradesco', label: 'Bradesco' },
  { value: 'Santander', label: 'Santander' },
  { value: 'Caixa', label: 'Caixa' },
  { value: 'Sicredi', label: 'Sicredi' },
  { value: 'Nu Bank', label: 'Nu Bank' },
  { value: 'C6 Bank', label: 'C6 Bank' },
]

const STATUS_VARIANT: Record<Boleto['status'], 'pos' | 'warn' | 'neg' | 'neutral'> = {
  pago: 'pos',
  aberto: 'warn',
  vencido: 'neg',
  cancelado: 'neutral',
}

const STATUS_LABEL: Record<Boleto['status'], string> = {
  pago: 'Pago',
  aberto: 'Aberto',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
}

export default function BoletosPage() {
  const { status } = useSession()
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

  const limit = 25

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') fetchBoletos()
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
    <AppShell>
      <PageHeader
        eyebrow={loading ? 'Financeiro · Carregando…' : `Financeiro · ${total} boleto${total === 1 ? '' : 's'}`}
        title="Boletos"
        subtitle="Cobranças, pagamentos e conciliação bancária."
        search={false}
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={handleExportExcel}
              disabled={loading || boletos.length === 0}
            >
              Exportar Excel
            </Button>
            <Link href="/boletos/novo">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Novo boleto</Button>
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
            containerClassName="w-48"
          />
          <Select
            options={BANCOS_OPTIONS}
            value={banco}
            onChange={(e) => {
              setBanco(e.target.value)
              setPage(1)
            }}
            containerClassName="w-48"
          />
        </div>

        {(search || statusFilter || banco) && (
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
            {banco && (
              <Chip variant="info" className="cursor-pointer" onClick={() => setBanco('')}>
                {banco} <X className="h-3 w-3 ml-1" />
              </Chip>
            )}
          </div>
        )}
      </Card>

      {!loading && total > 0 && (
        <p className="text-fg-3 text-small mb-4">
          Mostrando <span className="text-fg-1 t-num">{boletos.length}</span> de{' '}
          <span className="text-fg-1 t-num">{total}</span> boletos
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
      ) : boletos.length === 0 ? (
        <Card className="text-center py-16 space-y-3">
          <Wallet className="h-8 w-8 text-fg-3 mx-auto" />
          <p className="eyebrow">Vazio</p>
          <h3 className="text-h3 font-sans tracking-tight text-fg-1">Nenhum boleto criado</h3>
          <p className="text-fg-2 text-body">
            {search || statusFilter || banco
              ? 'Tente ajustar seus filtros.'
              : 'Comece criando seu primeiro boleto a partir de um contrato.'}
          </p>
          <div className="pt-2">
            <Link href="/boletos/novo">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Novo boleto</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {boletos.map((boleto) => (
              <Link key={boleto.id} href={`/boletos/${boleto.id}`}>
                <Card className="hover:bg-bg-3 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="text-fg-1 font-semibold t-num">BOL-{boleto.numero}</h3>
                        <Chip variant={STATUS_VARIANT[boleto.status]}>
                          {STATUS_LABEL[boleto.status]}
                        </Chip>
                      </div>
                      <p className="text-fg-2 text-small truncate">{boleto.cliente.nome}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="t-num-lg text-fg-1">
                        {formatCurrency(parseFloat(boleto.valor))}
                      </p>
                      <p className="text-fg-3 text-micro uppercase tracking-wider mt-0.5">
                        {boleto.banco}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-border-1 text-small">
                    <div className="flex gap-6">
                      <div>
                        <span className="text-fg-3 text-micro uppercase tracking-wider">
                          Criado
                        </span>
                        <p className="text-fg-2 t-num">{formatDate(boleto.criadoEm)}</p>
                      </div>
                      <div>
                        <span className="text-fg-3 text-micro uppercase tracking-wider">
                          Vencimento
                        </span>
                        <p className="text-fg-2 t-num">{formatDate(boleto.vencimento)}</p>
                      </div>
                    </div>

                    {boleto.linkBoleto && (
                      <a
                        href={boleto.linkBoleto}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-accent text-small hover:underline flex items-center gap-1"
                      >
                        Baixar boleto <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
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
