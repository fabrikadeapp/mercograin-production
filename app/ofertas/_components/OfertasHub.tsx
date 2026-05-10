'use client'
import * as React from 'react'

type Tipo = 'compra' | 'venda'

interface Oferta {
  id: string
  numero: string
  tipo: Tipo
  cultura: string
  qtdSc: string | number
  precoSc: string | number
  precoMoeda: string
  origem: string | null
  destino: string | null
  status: string
  publica: boolean
  validaAte: string
  createdAt: string
}

export function OfertasHub() {
  const [tab, setTab] = React.useState<Tipo>('compra')
  const [cultura, setCultura] = React.useState('')
  const [precoMin, setPrecoMin] = React.useState('')
  const [precoMax, setPrecoMax] = React.useState('')
  const [ofertas, setOfertas] = React.useState<Oferta[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    const sp = new URLSearchParams()
    sp.set('tipo', tab)
    if (cultura) sp.set('cultura', cultura)
    if (precoMin) sp.set('precoMin', precoMin)
    if (precoMax) sp.set('precoMax', precoMax)
    try {
      const r = await fetch(`/api/ofertas?${sp.toString()}`, { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setOfertas(j.ofertas || [])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'falha ao carregar')
    }
  }, [tab, cultura, precoMin, precoMax])

  React.useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab('compra')}
          className={`rounded-lg px-3 py-1.5 text-sm ${tab === 'compra' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-zinc-300'}`}
        >
          Compra
        </button>
        <button
          onClick={() => setTab('venda')}
          className={`rounded-lg px-3 py-1.5 text-sm ${tab === 'venda' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-zinc-300'}`}
        >
          Venda
        </button>
        <select
          value={cultura}
          onChange={(e) => setCultura(e.target.value)}
          className="ml-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
        >
          <option value="">Todas culturas</option>
          <option value="soja">Soja</option>
          <option value="milho">Milho</option>
          <option value="trigo">Trigo</option>
        </select>
        <input
          placeholder="Preço min R$/sc"
          value={precoMin}
          onChange={(e) => setPrecoMin(e.target.value)}
          className="w-32 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
        />
        <input
          placeholder="Preço max R$/sc"
          value={precoMax}
          onChange={(e) => setPrecoMax(e.target.value)}
          className="w-32 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!ofertas && <p className="text-sm text-zinc-400">Carregando…</p>}
      {ofertas && ofertas.length === 0 && (
        <p className="text-sm text-zinc-400">Nenhuma oferta encontrada para os filtros.</p>
      )}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900/40">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="px-3 py-2 text-left">Nº</th>
              <th className="px-3 py-2 text-left">Cultura</th>
              <th className="px-3 py-2 text-right">Qtd (sc)</th>
              <th className="px-3 py-2 text-right">Preço/sc</th>
              <th className="px-3 py-2 text-left">Rota</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Pública?</th>
              <th className="px-3 py-2 text-left">Válida até</th>
            </tr>
          </thead>
          <tbody>
            {ofertas?.map((o) => (
              <tr key={o.id} className="border-t border-white/5 text-zinc-200">
                <td className="px-3 py-2 font-mono text-xs">{o.numero}</td>
                <td className="px-3 py-2 capitalize">{o.cultura}</td>
                <td className="px-3 py-2 text-right">
                  {Number(o.qtdSc).toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2 text-right">
                  {o.precoMoeda} {Number(o.precoSc).toFixed(2)}
                </td>
                <td className="px-3 py-2">{o.origem || '—'} → {o.destino || '—'}</td>
                <td className="px-3 py-2">
                  <span className={
                    o.status === 'aberta' ? 'text-emerald-400' :
                    o.status === 'aceita' ? 'text-sky-400' :
                    o.status === 'expirada' ? 'text-zinc-500' :
                    'text-red-400'
                  }>{o.status}</span>
                </td>
                <td className="px-3 py-2">{o.publica ? 'Sim' : '—'}</td>
                <td className="px-3 py-2 text-xs text-zinc-400">
                  {new Date(o.validaAte).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
