'use client'
import * as React from 'react'

interface OfertaPublica {
  id: string
  numero: string
  tipo: 'compra' | 'venda'
  cultura: string
  qtdSc: string | number
  precoSc: string | number
  precoMoeda: string
  origem: string | null
  destino: string | null
  validaAte: string
  originador: { name: string; slug: string }
  own: boolean
}

export function MarketplaceList() {
  const [tipo, setTipo] = React.useState<'compra' | 'venda' | ''>('')
  const [cultura, setCultura] = React.useState('')
  const [ofertas, setOfertas] = React.useState<OfertaPublica[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [clientes, setClientes] = React.useState<Array<{ id: string; nome: string }> | null>(null)

  const load = React.useCallback(async () => {
    const sp = new URLSearchParams()
    if (tipo) sp.set('tipo', tipo)
    if (cultura) sp.set('cultura', cultura)
    try {
      const r = await fetch(`/api/ofertas/marketplace?${sp.toString()}`, { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setOfertas(j.ofertas || [])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'falha ao carregar marketplace')
    }
  }, [tipo, cultura])

  React.useEffect(() => { void load() }, [load])
  React.useEffect(() => {
    fetch('/api/clientes?take=200', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return
        const arr = (j.clientes || j.data || j || []) as Array<{ id: string; nome: string }>
        if (Array.isArray(arr)) setClientes(arr.map((c) => ({ id: c.id, nome: c.nome })))
      })
      .catch(() => {})
  }, [])

  async function aceitar(o: OfertaPublica) {
    if (!clientes || clientes.length === 0) {
      alert('Cadastre um cliente antes de fazer proposta.')
      return
    }
    const clienteId = window.prompt(
      `Aceitar oferta ${o.numero} de ${o.originador.name}\n\nID do cliente contraparte:\n` +
      clientes.slice(0, 10).map((c) => `${c.id} — ${c.nome}`).join('\n'),
      clientes[0]?.id || '',
    )
    if (!clienteId) return
    try {
      const r = await fetch(`/api/ofertas/${o.id}/aceitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${r.status}`)
      }
      alert('Proposta criada com sucesso!')
      void load()
    } catch (e: any) {
      alert(`Falha: ${e?.message || e}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as any)}
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
        >
          <option value="">Todos tipos</option>
          <option value="compra">Compra</option>
          <option value="venda">Venda</option>
        </select>
        <select
          value={cultura}
          onChange={(e) => setCultura(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
        >
          <option value="">Todas culturas</option>
          <option value="soja">Soja</option>
          <option value="milho">Milho</option>
          <option value="trigo">Trigo</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!ofertas && <p className="text-sm text-zinc-400">Carregando…</p>}
      {ofertas && ofertas.length === 0 && (
        <p className="text-sm text-zinc-400">Nenhuma oferta pública aberta no momento.</p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ofertas?.map((o) => (
          <li key={o.id} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-zinc-400">{o.numero}</span>
              <span className={`rounded-full px-2 py-0.5 ${o.tipo === 'compra' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-amber-900/40 text-amber-300'}`}>
                {o.tipo.toUpperCase()}
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold capitalize text-white">{o.cultura}</p>
            <p className="text-sm text-zinc-200">
              {Number(o.qtdSc).toLocaleString('pt-BR')} sc · {o.precoMoeda} {Number(o.precoSc).toFixed(2)}/sc
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {o.origem || '—'} → {o.destino || '—'}
            </p>
            <p className="mt-2 text-xs text-zinc-300">por <strong>{o.originador.name}</strong></p>
            <p className="text-xs text-zinc-500">Válida até {new Date(o.validaAte).toLocaleString('pt-BR')}</p>
            <button
              type="button"
              disabled={o.own}
              onClick={() => aceitar(o)}
              className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              title={o.own ? 'Oferta da sua própria corretora' : 'Criar proposta a partir desta oferta'}
            >
              {o.own ? 'Sua oferta' : 'Fazer proposta'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
