'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Users, Filter, Pencil, Trash2, X } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Chip,
  Badge,
  Select,
  SearchField,
  DenseTable,
  type DenseTableColumn,
} from '@/components/ui/phb'
import { Pagination } from '@/components/ui/Pagination'
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

const TIPO_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'comprador', label: 'Comprador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'ambos', label: 'Ambos' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'true', label: 'Ativo' },
  { value: 'false', label: 'Inativo' },
]

export default function ClientesPage() {
  const { status } = useSession()
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

  const tipoLabel = (t: Cliente['tipo']) =>
    t === 'ambos' ? 'Comprador/Vendedor' : t === 'comprador' ? 'Comprador' : 'Vendedor'

  const columns: DenseTableColumn<Cliente>[] = [
    {
      key: 'nome',
      header: 'Nome',
      accessor: (c) => <span className="text-fg-1 font-medium">{c.nome}</span>,
    },
    {
      key: 'email',
      header: 'E-mail',
      accessor: (c) => <span className="text-fg-2">{c.email || '—'}</span>,
    },
    {
      key: 'telefone',
      header: 'Telefone',
      accessor: (c) => <span className="text-fg-2 t-num">{c.telefone || '—'}</span>,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      accessor: (c) => <Chip variant="info">{tipoLabel(c.tipo)}</Chip>,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (c) => (
        <Chip variant={c.ativo ? 'pos' : 'neutral'}>{c.ativo ? 'Ativo' : 'Inativo'}</Chip>
      ),
    },
    {
      key: 'criadaEm',
      header: 'Criado em',
      isNumeric: true,
      accessor: (c) => <span className="text-fg-2">{formatDate(c.criadaEm)}</span>,
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      accessor: (c) => (
        <div className="flex gap-2 justify-end">
          <Link href={`/clientes/${c.id}/editar`}>
            <Button variant="ghost" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />}>
              Editar
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(c.id, c.nome)}
            className="text-neg hover:text-neg"
            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
          >
            Deletar
          </Button>
        </div>
      ),
    },
  ]

  return (
    <AppShell>
      <PageHeader
        eyebrow={loading ? 'Cadastro · Carregando…' : `Cadastro · ${total} cliente${total === 1 ? '' : 's'}`}
        title="Clientes"
        subtitle="Gerencie clientes, parceiros e contrapartes comerciais."
        search={false}
        actions={
          <Link href="/clientes/novo">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Novo cliente</Button>
          </Link>
        }
      />

      <Card className="mb-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchField
            placeholder="Buscar por nome, e-mail ou CNPJ…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            containerClassName="flex-1 min-w-[260px]"
          />
          <Select
            options={TIPO_OPTIONS}
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value)
              setPage(1)
            }}
            containerClassName="w-48"
          />
          <Select
            options={STATUS_OPTIONS}
            value={ativo}
            onChange={(e) => {
              setAtivo(e.target.value)
              setPage(1)
            }}
            containerClassName="w-48"
          />
        </div>

        {(search || tipo || ativo) && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border-1">
            <span className="eyebrow flex items-center gap-1.5">
              <Filter className="h-3 w-3" /> Filtros ativos
            </span>
            {search && (
              <Chip variant="info" className="cursor-pointer" onClick={() => setSearch('')}>
                {search} <X className="h-3 w-3 ml-1" />
              </Chip>
            )}
            {tipo && (
              <Chip variant="info" className="cursor-pointer" onClick={() => setTipo('')}>
                {tipoLabel(tipo as Cliente['tipo'])} <X className="h-3 w-3 ml-1" />
              </Chip>
            )}
            {ativo && (
              <Chip variant="info" className="cursor-pointer" onClick={() => setAtivo('')}>
                {ativo === 'true' ? 'Ativo' : 'Inativo'} <X className="h-3 w-3 ml-1" />
              </Chip>
            )}
          </div>
        )}
      </Card>

      {!loading && total > 0 && (
        <p className="text-fg-3 text-small mb-4">
          Mostrando <span className="text-fg-1 t-num">{clientes.length}</span> de{' '}
          <span className="text-fg-1 t-num">{total}</span> clientes
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
      ) : clientes.length === 0 ? (
        <Card className="text-center py-16 space-y-3">
          <Users className="h-8 w-8 text-fg-3 mx-auto" />
          <p className="eyebrow">Vazio</p>
          <h3 className="text-h3 font-sans tracking-tight text-fg-1">
            Nenhum cliente encontrado
          </h3>
          <p className="text-fg-2 text-body">
            {search || tipo || ativo
              ? 'Tente ajustar seus filtros.'
              : 'Comece adicionando seu primeiro cliente.'}
          </p>
          <div className="pt-2">
            <Link href="/clientes/novo">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Novo cliente</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <DenseTable columns={columns} rows={clientes} rowKey={(c) => c.id} />

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
