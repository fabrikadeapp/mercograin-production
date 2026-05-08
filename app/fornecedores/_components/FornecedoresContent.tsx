'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Pencil, Trash2, Package, Download, Plus } from 'lucide-react'
import {
  Card,
  Button,
  Chip,
  Tabs,
  SearchField,
  DenseTable,
  type DenseTableColumn,
} from '@/components/ui/phb'

type Tipo =
  | 'transportadora'
  | 'armazem'
  | 'insumos'
  | 'certificadora'
  | 'outros'

interface Fornecedor {
  id: string
  tipo: Tipo
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string | null
  contato: string | null
  telefone: string | null
  email: string | null
  cidade: string | null
  uf: string | null
  ativo: boolean
}

interface ApiResponse {
  data: Fornecedor[]
  total: number
  page: number
  limit: number
  pages: number
  counts: {
    all: number
    ativos: number
    byTipo: Record<string, number>
  }
}

const TIPO_LABEL: Record<Tipo, string> = {
  transportadora: 'Transportadora',
  armazem: 'Armazém',
  insumos: 'Insumos',
  certificadora: 'Certificadora',
  outros: 'Outros',
}

function tipoBadge(tipo: Tipo): React.ReactNode {
  // Map to PHB Badge variants — fallback to neutral chip-like style via Badge variants available
  // Available Badge variants: depende do componente. Usamos Badge com classes utilitárias.
  const styles: Record<Tipo, { bg: string; fg: string; label: string }> = {
    transportadora: {
      bg: 'rgba(59,130,246,0.15)',
      fg: '#60a5fa',
      label: 'Transportadora',
    },
    armazem: {
      bg: 'rgba(234,179,8,0.18)',
      fg: '#fbbf24',
      label: 'Armazém',
    },
    insumos: {
      bg: 'rgba(245,158,11,0.18)',
      fg: '#f59e0b',
      label: 'Insumos',
    },
    certificadora: {
      bg: 'rgba(168,85,247,0.18)',
      fg: '#c084fc',
      label: 'Certificadora',
    },
    outros: {
      bg: 'rgba(148,163,184,0.18)',
      fg: '#cbd5e1',
      label: 'Outros',
    },
  }
  const s = styles[tipo] || styles.outros
  return (
    <span
      className="inline-flex items-center px-2 h-5 rounded-pill text-micro font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  )
}

export function FornecedoresContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [data, setData] = React.useState<Fornecedor[]>([])
  const [counts, setCounts] = React.useState<ApiResponse['counts']>({
    all: 0,
    ativos: 0,
    byTipo: {},
  })
  const [loading, setLoading] = React.useState(true)
  const [tipo, setTipo] = React.useState<string>(searchParams.get('tipo') || '')
  const [q, setQ] = React.useState<string>(searchParams.get('q') || '')
  const [showInativos, setShowInativos] = React.useState<boolean>(
    searchParams.get('ativo') === 'false'
  )
  const [page, setPage] = React.useState<number>(
    parseInt(searchParams.get('page') || '1')
  )
  const [pages, setPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)

  const limit = 20

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (tipo) params.set('tipo', tipo)
      if (q) params.set('q', q)
      // Por padrão, mostra apenas ativos. Se showInativos=true, traz tudo (omit param).
      if (!showInativos) params.set('ativo', 'true')

      const res = await fetch(`/api/fornecedores?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao buscar fornecedores')
      const json: ApiResponse = await res.json()
      setData(json.data)
      setCounts(json.counts)
      setPages(json.pages)
      setTotal(json.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, tipo, q, showInativos])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Debounce search reset page
  React.useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
    }, 250)
    return () => clearTimeout(t)
  }, [q, tipo, showInativos])

  // Sync URL
  React.useEffect(() => {
    const params = new URLSearchParams()
    if (page !== 1) params.set('page', String(page))
    if (tipo) params.set('tipo', tipo)
    if (q) params.set('q', q)
    if (showInativos) params.set('ativo', 'false')
    const qs = params.toString()
    router.replace(`/fornecedores${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [page, tipo, q, showInativos, router])

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Excluir o fornecedor "${nome}"? Esta ação não pode ser desfeita.`))
      return
    try {
      const res = await fetch(`/api/fornecedores/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir')
      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  const tabOptions = React.useMemo(
    () => [
      { value: '', label: 'Todos', count: counts.all },
      {
        value: 'transportadora',
        label: 'Transportadoras',
        count: counts.byTipo.transportadora || 0,
      },
      {
        value: 'armazem',
        label: 'Armazéns',
        count: counts.byTipo.armazem || 0,
      },
      {
        value: 'insumos',
        label: 'Insumos',
        count: counts.byTipo.insumos || 0,
      },
      {
        value: 'certificadora',
        label: 'Certificadoras',
        count: counts.byTipo.certificadora || 0,
      },
      { value: 'outros', label: 'Outros', count: counts.byTipo.outros || 0 },
    ],
    [counts]
  )

  const columns: DenseTableColumn<Fornecedor>[] = [
    {
      key: 'razao',
      header: 'Razão social',
      accessor: (f) => (
        <div className="min-w-0">
          <div className="text-fg-1 font-medium truncate">{f.razaoSocial}</div>
          {f.nomeFantasia ? (
            <div className="eyebrow truncate">{f.nomeFantasia}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      accessor: (f) => tipoBadge(f.tipo),
    },
    {
      key: 'cnpj',
      header: 'CNPJ',
      accessor: (f) => (
        <span className="text-fg-2 t-num">{f.cnpj || '—'}</span>
      ),
    },
    {
      key: 'contato',
      header: 'Contato',
      accessor: (f) => (
        <div className="min-w-0">
          <div className="text-fg-1 truncate">{f.contato || '—'}</div>
          {f.telefone ? (
            <div className="text-fg-3 text-micro t-num truncate">
              {f.telefone}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'cidade',
      header: 'Cidade/UF',
      accessor: (f) => (
        <span className="text-fg-2">
          {f.cidade ? `${f.cidade}${f.uf ? `/${f.uf}` : ''}` : f.uf || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (f) => (
        <Chip variant={f.ativo ? 'pos' : 'neutral'}>
          {f.ativo ? 'Ativo' : 'Inativo'}
        </Chip>
      ),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      accessor: (f) => (
        <div className="flex justify-end gap-2">
          <Link href={`/fornecedores/${f.id}/editar`}>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Pencil className="h-3.5 w-3.5" />}
            >
              Editar
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(f.id, f.razaoSocial)}
            className="text-neg hover:text-neg"
            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
          >
            Excluir
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <Card className="mb-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Tabs
            options={tabOptions}
            value={tipo}
            onChange={(v) => setTipo(v)}
            size="sm"
          />
          <div className="flex-1" />
          <a
            href={`/api/fornecedores/export${
              tipo ? `?tipo=${tipo}` : ''
            }${!showInativos ? `${tipo ? '&' : '?'}ativo=true` : ''}`}
            target="_blank"
            rel="noreferrer"
          >
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Download className="h-3.5 w-3.5" />}
            >
              Exportar CSV
            </Button>
          </a>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SearchField
            placeholder="Buscar por razão social, CNPJ, fantasia…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            containerClassName="flex-1 min-w-[260px]"
          />
          <label className="inline-flex items-center gap-2 cursor-pointer text-small text-fg-2">
            <input
              type="checkbox"
              checked={showInativos}
              onChange={(e) => setShowInativos(e.target.checked)}
              className="h-4 w-4 rounded border-border-1 bg-bg-2 accent-accent"
            />
            Mostrar inativos
          </label>
        </div>
      </Card>

      {!loading && total > 0 ? (
        <p className="text-fg-3 text-small mb-4">
          Mostrando <span className="text-fg-1 t-num">{data.length}</span> de{' '}
          <span className="text-fg-1 t-num">{total}</span> fornecedor
          {total === 1 ? '' : 'es'}
          {pages > 1 ? (
            <>
              {' '}· Página{' '}
              <span className="text-fg-1 t-num">{page}</span> de{' '}
              <span className="text-fg-1 t-num">{pages}</span>
            </>
          ) : null}
        </p>
      ) : null}

      {loading ? (
        <Card className="text-center py-16 text-fg-3 text-small">
          Carregando…
        </Card>
      ) : data.length === 0 ? (
        <Card className="text-center py-16 space-y-3">
          <Package className="h-8 w-8 text-fg-3 mx-auto" />
          <p className="eyebrow">Vazio</p>
          <h3 className="text-h3 font-sans tracking-tight text-fg-1">
            Nenhum fornecedor encontrado
          </h3>
          <p className="text-fg-2 text-body">
            {q || tipo
              ? 'Tente ajustar seus filtros.'
              : 'Cadastre seu primeiro fornecedor para começar.'}
          </p>
          <div className="pt-2">
            <Link href="/fornecedores/novo">
              <Button leftIcon={<Plus className="h-4 w-4" />}>
                Cadastre seu primeiro fornecedor
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <DenseTable columns={columns} rows={data} rowKey={(f) => f.id} />
          {pages > 1 ? (
            <div className="mt-6 flex justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="inline-flex items-center px-3 text-small text-fg-2 t-num">
                {page} / {pages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
              >
                Próxima
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}
