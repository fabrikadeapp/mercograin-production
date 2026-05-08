'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Users,
  FileText,
  Handshake,
  Wallet,
  PlusCircle,
  Pencil,
  Trash2,
  Eye,
  RefreshCw,
  ScrollText,
} from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Chip,
  Select,
} from '@/components/ui/phb'
import { Pagination } from '@/components/ui/Pagination'
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

const ENTIDADE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  cliente: Users,
  proposta: FileText,
  contrato: Handshake,
  boleto: Wallet,
}

const ACAO_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  criar: PlusCircle,
  atualizar: Pencil,
  deletar: Trash2,
  visualizar: Eye,
}

const ACAO_VARIANT: Record<string, 'pos' | 'info' | 'neg' | 'neutral'> = {
  criar: 'pos',
  atualizar: 'info',
  deletar: 'neg',
  visualizar: 'neutral',
}

const ENTIDADE_OPTIONS = [
  { value: '', label: 'Todas as entidades' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'boleto', label: 'Boleto' },
]

const ACAO_OPTIONS = [
  { value: '', label: 'Todas as ações' },
  { value: 'criar', label: 'Criar' },
  { value: 'atualizar', label: 'Atualizar' },
  { value: 'deletar', label: 'Deletar' },
  { value: 'visualizar', label: 'Visualizar' },
]

export default function AuditoriaPage() {
  const { status } = useSession()
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
    if (status === 'authenticated') fetchLogs()
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

  useEffect(() => {
    setPage(1)
    fetchLogs()
  }, [entidadeFilter, acaoFilter])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    fetchLogs()
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow={loading ? 'Compliance · Carregando…' : `Compliance · ${total} registro${total === 1 ? '' : 's'}`}
        title="Log de auditoria"
        subtitle="Histórico imutável de todas as ações executadas no sistema."
        search={false}
        actions={
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={fetchLogs}
          >
            Atualizar
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            options={ENTIDADE_OPTIONS}
            value={entidadeFilter}
            onChange={(e) => setEntidadeFilter(e.target.value)}
            containerClassName="w-56"
            label="Entidade"
          />
          <Select
            options={ACAO_OPTIONS}
            value={acaoFilter}
            onChange={(e) => setAcaoFilter(e.target.value)}
            containerClassName="w-56"
            label="Ação"
          />
        </div>
      </Card>

      {loading ? (
        <Card className="text-center py-16 text-fg-3 text-small">Carregando…</Card>
      ) : logs.length === 0 ? (
        <Card className="text-center py-16 space-y-3">
          <ScrollText className="h-8 w-8 text-fg-3 mx-auto" />
          <p className="eyebrow">Vazio</p>
          <h3 className="text-h3 font-sans tracking-tight text-fg-1">
            Nenhum registro de auditoria
          </h3>
          <p className="text-fg-2 text-body">
            Os eventos do sistema aparecerão aqui conforme forem gerados.
          </p>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {logs.map((log) => {
              const EntIcon = ENTIDADE_ICON[log.entidade] || ScrollText
              const AcaoIcon = ACAO_ICON[log.acao] || Pencil
              return (
                <Card key={log.id} className="!p-4">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-md bg-bg-2 border border-border-1 flex items-center justify-center shrink-0">
                      <EntIcon className="h-4 w-4 text-fg-2" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-fg-1 font-medium text-small capitalize">
                          {log.entidade}
                        </span>
                        <Chip variant={ACAO_VARIANT[log.acao] || 'neutral'} leftIcon={<AcaoIcon className="h-3 w-3" />}>
                          {log.acao}
                        </Chip>
                        <span className="text-fg-3 text-micro uppercase tracking-wider t-num">
                          ID: {log.entidadeId.substring(0, 8)}
                        </span>
                      </div>

                      {log.mudancas && Object.keys(log.mudancas).length > 0 && (
                        <div className="bg-bg-2 border border-border-1 rounded-sm p-2 mb-2">
                          <p className="eyebrow mb-1">Alterações</p>
                          <ul className="space-y-0.5 text-small text-fg-2">
                            {Object.entries(log.mudancas).map(([key, value]) => (
                              <li key={key} className="t-num">
                                <span className="text-fg-1 font-medium">{key}:</span>{' '}
                                {JSON.stringify(value)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-4 text-micro uppercase tracking-wider text-fg-3">
                        <span className="t-num">{formatDate(new Date(log.criadoEm))}</span>
                        {log.ipAddress && <span className="t-num">IP: {log.ipAddress}</span>}
                      </div>
                    </div>
                  </div>
                </Card>
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
