'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'

interface Item {
  id: string
  tipo: string
  grao: string
  quantidade: string
  unidade: string
  precoAlvo: string | null
  prazoEntregaDias: number | null
  localEntrega: string | null
  observacao: string | null
  status: string
  createdAt: string
  cliente: { id: string; nome: string; email: string | null; whatsapp: string | null }
  proposta: { id: string; numero: string; status: string; valorTotal: string } | null
}

const STATUS = [
  { key: 'pendente', label: 'Pendente' },
  { key: 'em_analise', label: 'Em análise' },
  { key: 'convertida', label: 'Convertida' },
  { key: 'recusada', label: 'Recusada' },
]

export function SolicitacoesView() {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filtro, setFiltro] = useState<string>('pendente')
  const [loading, setLoading] = useState(true)
  const [acao, setAcao] = useState<string | null>(null)
  const [precos, setPrecos] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const r = await fetch('/api/solicitacoes' + (filtro ? `?status=${filtro}` : ''))
    const j = await r.json().catch(() => ({}))
    if (r.ok) {
      setItems(j.items ?? [])
      const c: Record<string, number> = {}
      for (const x of j.counts ?? []) c[x.status] = x._count?._all ?? 0
      setCounts(c)
    }
    setLoading(false)
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro])

  async function converter(id: string) {
    const preco = Number(precos[id] ?? 0)
    if (!preco || preco <= 0) {
      alert('Informe um preço válido por unidade.')
      return
    }
    setAcao(id)
    try {
      const r = await fetch(`/api/solicitacoes/${id}/converter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preco }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        alert('Falha: ' + (j.error ?? 'erro'))
        return
      }
      router.push(`/propostas/${j.propostaId}`)
    } finally {
      setAcao(null)
    }
  }

  async function recusar(id: string) {
    const motivo = prompt('Motivo da recusa (opcional):') ?? ''
    setAcao(id)
    try {
      // Atualiza direto via API simples (criamos um endpoint dedicado? por ora usamos /api/solicitacoes/[id])
      const r = await fetch(`/api/solicitacoes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'recusada', motivoRecusa: motivo }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        alert('Falha: ' + (j.error ?? 'erro'))
        return
      }
      await load()
    } finally {
      setAcao(null)
    }
  }

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts])

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Solicitações de cotação</h1>
        <p className="text-sm text-gray-600 mt-1">
          {total} solicitação(ões) total. Os clientes pedem cotação direto pelo portal; aqui você converte em proposta.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUS.map((s) => (
          <button
            key={s.key}
            onClick={() => setFiltro(s.key)}
            className={
              'rounded border px-3 py-1 text-sm ' +
              (filtro === s.key
                ? 'border-green-700 bg-green-50 text-green-800'
                : 'border-gray-300 bg-white text-gray-700')
            }
          >
            {s.label} ({counts[s.key] ?? 0})
          </button>
        ))}
        <button onClick={() => setFiltro('')} className="rounded border border-gray-300 bg-white px-3 py-1 text-sm">
          Todos
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border bg-white p-10 text-center text-gray-500">
          Nenhuma solicitação neste filtro.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <div key={s.id} className="rounded-lg border bg-white p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{s.cliente.nome}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(s.createdAt).toLocaleString('pt-BR')}
                  </div>
                </div>
                <span
                  className={
                    'rounded-full px-2 py-0.5 text-xs font-medium ' +
                    (s.status === 'pendente'
                      ? 'bg-amber-50 text-amber-800'
                      : s.status === 'convertida'
                      ? 'bg-green-50 text-green-800'
                      : s.status === 'recusada'
                      ? 'bg-red-50 text-red-800'
                      : 'bg-blue-50 text-blue-800')
                  }
                >
                  {s.status}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div>
                  <div className="text-xs text-gray-500">Tipo</div>
                  <div>{s.tipo === 'venda' ? 'Quer vender' : 'Quer comprar'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Grão</div>
                  <div className="capitalize">{s.grao}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Quantidade</div>
                  <div>{Number(s.quantidade)} {s.unidade}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Preço alvo</div>
                  <div>{s.precoAlvo ? `R$ ${Number(s.precoAlvo)}/${s.unidade}` : '—'}</div>
                </div>
              </div>
              {s.observacao && (
                <div className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700">
                  <strong>Obs:</strong> {s.observacao}
                </div>
              )}
              {s.proposta && (
                <div className="mt-2 text-xs text-green-700">
                  Convertida em proposta{' '}
                  <a className="underline" href={`/propostas/${s.proposta.id}`}>{s.proposta.numero}</a> ·{' '}
                  R$ {Number(s.proposta.valorTotal).toLocaleString('pt-BR')}
                </div>
              )}
              {s.status === 'pendente' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={`Preço por ${s.unidade}`}
                    value={precos[s.id] ?? ''}
                    onChange={(e) => setPrecos((p) => ({ ...p, [s.id]: e.target.value }))}
                    className="w-40 rounded border px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => converter(s.id)}
                    disabled={acao === s.id}
                    className="inline-flex items-center gap-1 rounded bg-green-700 px-3 py-1 text-sm text-white"
                  >
                    {acao === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                    Converter em proposta <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => recusar(s.id)}
                    disabled={acao === s.id}
                    className="inline-flex items-center gap-1 rounded border border-red-300 px-3 py-1 text-sm text-red-700"
                  >
                    <XCircle className="h-3 w-3" /> Recusar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
