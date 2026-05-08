'use client'
import * as React from 'react'
import Link from 'next/link'
import { Trash2, Plus, Pencil } from 'lucide-react'
import {
  Card,
  Tabs,
  Chip,
  GrainBadge,
  Button,
  EmptyState,
  Skeleton,
} from '@/components/ui/phb'

interface Futuro {
  id: string
  grao: string
  lado: 'compra' | 'venda'
  vencimento: string
  precoSc: number | string
  volumeSc: number
  codigoVenc?: string | null
  praca?: string | null
  status: string
  cliente?: { id: string; nome: string } | null
  observacao?: string | null
  criadoEm: string
}

const GRAOS_FILTRO = [
  { value: '', label: 'Todos' },
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
  { value: 'sorgo', label: 'Sorgo' },
]

const STATUS_FILTRO = [
  { value: '', label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'executado', label: 'Executados' },
  { value: 'cancelado', label: 'Cancelados' },
]

const MES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function fmtVencimento(iso: string): { label: string; codigo: string } {
  const d = new Date(iso)
  const label = `${MES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`
  return { label, codigo: '' }
}

function fmtBRL(n: number | string, d = 2): string {
  const num = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(num)) return '—'
  return num.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtVol(sc: number): string {
  if (!Number.isFinite(sc)) return '—'
  return sc.toLocaleString('pt-BR')
}

export function FuturosContent() {
  const [grao, setGrao] = React.useState('')
  const [status, setStatus] = React.useState('ativo')
  const [data, setData] = React.useState<Futuro[]>([])
  const [loading, setLoading] = React.useState(true)
  const [total, setTotal] = React.useState(0)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (grao) params.set('grao', grao)
      if (status) params.set('status', status)
      const r = await fetch(`/api/futuros?${params}`, { cache: 'no-store' })
      if (!r.ok) throw new Error()
      const j = await r.json()
      setData(j.data || [])
      setTotal(j.total || 0)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [grao, status])

  React.useEffect(() => { fetchData() }, [fetchData])

  async function handleDelete(id: string) {
    if (!confirm('Cancelar este contrato futuro? Ele será marcado como cancelado.')) return
    try {
      await fetch(`/api/futuros/${id}`, { method: 'DELETE' })
      fetchData()
    } catch { /* */ }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            options={GRAOS_FILTRO as any}
            value={grao}
            onChange={(v) => setGrao(v)}
            size="sm"
          />
          <span className="text-fg-4">·</span>
          <Tabs
            options={STATUS_FILTRO as any}
            value={status}
            onChange={(v) => setStatus(v)}
            size="sm"
          />
          <span className="ml-auto text-fg-3 text-small">{total} {total === 1 ? 'contrato' : 'contratos'}</span>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={40} />)}
          </div>
        ) : data.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="Sem contratos futuros"
              description="Adicione seu primeiro contrato futuro para começar a montar o book."
              cta={
                <Link href="/futuros/novo">
                  <Button leftIcon={<Plus className="h-4 w-4" />}>Novo contrato</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <table className="w-full text-small">
            <thead>
              <tr className="text-fg-3 text-micro uppercase tracking-wider border-b border-border-1">
                <th className="text-left py-3 px-5">Vencimento</th>
                <th className="text-left py-3 px-5">Grão</th>
                <th className="text-left py-3 px-5">Lado</th>
                <th className="text-right py-3 px-5">Preço</th>
                <th className="text-right py-3 px-5">Volume</th>
                <th className="text-right py-3 px-5">Total</th>
                <th className="text-left py-3 px-5">Cliente</th>
                <th className="text-right py-3 px-5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((f) => {
                const v = fmtVencimento(f.vencimento)
                const preco = Number(f.precoSc)
                const total = preco * f.volumeSc
                const ladoColor = f.lado === 'compra' ? 'pos' : 'neg'
                return (
                  <tr key={f.id} className="border-b border-border-1 hover:bg-bg-3/40 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex flex-col">
                        <span className="text-fg-1 font-medium">{v.label}</span>
                        {f.codigoVenc ? (
                          <span className="text-micro text-fg-3 t-num">{f.codigoVenc}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <GrainBadge variant={f.grao as any} />
                    </td>
                    <td className="py-3 px-5">
                      <Chip variant={ladoColor as any}>{f.lado === 'compra' ? 'COMPRA' : 'VENDA'}</Chip>
                    </td>
                    <td className="py-3 px-5 text-right t-num text-fg-1">{fmtBRL(preco)}</td>
                    <td className="py-3 px-5 text-right t-num text-fg-2">{fmtVol(f.volumeSc)} sc</td>
                    <td className="py-3 px-5 text-right t-num text-fg-1 font-medium">R$ {fmtBRL(total)}</td>
                    <td className="py-3 px-5 text-fg-2">{f.cliente?.nome || <span className="text-fg-4">—</span>}</td>
                    <td className="py-3 px-5">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/futuros/${f.id}/editar`}
                          className="p-1.5 text-fg-3 hover:text-accent rounded transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(f.id)}
                          className="p-1.5 text-fg-3 hover:text-neg rounded transition-colors"
                          title="Cancelar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
