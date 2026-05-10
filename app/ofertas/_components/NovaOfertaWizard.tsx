'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'

type Tipo = 'compra' | 'venda'

interface Props { tipoInicial: Tipo }

const PASSO_LABELS = ['Tipo & Cultura', 'Quantidade & Preço', 'Rota & Validade']

export function NovaOfertaWizard({ tipoInicial }: Props) {
  const router = useRouter()
  const [passo, setPasso] = React.useState(1)
  const [tipo, setTipo] = React.useState<Tipo>(tipoInicial)
  const [cultura, setCultura] = React.useState('soja')
  const [qtdSc, setQtdSc] = React.useState('')
  const [precoSc, setPrecoSc] = React.useState('')
  const [precoMoeda, setPrecoMoeda] = React.useState<'BRL' | 'USD'>('BRL')
  const [origem, setOrigem] = React.useState('')
  const [destino, setDestino] = React.useState('')
  const [validadeHoras, setValidadeHoras] = React.useState('72')
  const [publica, setPublica] = React.useState(false)
  const [observacao, setObservacao] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function valida(p: number): string | null {
    if (p === 1 && !cultura) return 'Selecione a cultura'
    if (p === 2) {
      if (!qtdSc || Number(qtdSc) <= 0) return 'Quantidade inválida'
      if (!precoSc || Number(precoSc) <= 0) return 'Preço inválido'
    }
    if (p === 3) {
      const h = Number(validadeHoras)
      if (!Number.isFinite(h) || h < 1 || h > 720) return 'Validade entre 1h e 720h'
    }
    return null
  }

  function avancar() {
    const err = valida(passo)
    if (err) { setError(err); return }
    setError(null)
    setPasso((p) => Math.min(3, p + 1))
  }
  function voltar() {
    setError(null)
    setPasso((p) => Math.max(1, p - 1))
  }

  async function enviar() {
    const err = valida(3) || valida(2) || valida(1)
    if (err) { setError(err); return }
    setSaving(true)
    try {
      const r = await fetch('/api/ofertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          cultura,
          qtdSc: Number(qtdSc),
          precoSc: Number(precoSc),
          precoMoeda,
          origem: origem || null,
          destino: destino || null,
          validadeHoras: Number(validadeHoras),
          publica,
          observacao: observacao || null,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${r.status}`)
      }
      router.push('/ofertas')
    } catch (e: any) {
      setError(e?.message || 'falha ao criar oferta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <ol className="flex items-center gap-2 text-xs">
        {PASSO_LABELS.map((label, i) => {
          const ativo = i + 1 === passo
          const concluido = i + 1 < passo
          return (
            <li key={label} className={`rounded-full px-3 py-1 ${ativo ? 'bg-emerald-600 text-white' : concluido ? 'bg-emerald-900/40 text-emerald-300' : 'bg-white/5 text-zinc-400'}`}>
              {i + 1}. {label}
            </li>
          )
        })}
      </ol>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
        {passo === 1 && (
          <div className="grid gap-4">
            <div>
              <label className="text-xs text-zinc-300">Tipo de oferta</label>
              <div className="mt-1 flex gap-2">
                {(['compra', 'venda'] as Tipo[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`rounded-lg px-3 py-1.5 text-sm capitalize ${tipo === t ? 'bg-emerald-600 text-white' : 'bg-white/5 text-zinc-300'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-300">Cultura</label>
              <select
                value={cultura}
                onChange={(e) => setCultura(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              >
                <option value="soja">Soja</option>
                <option value="milho">Milho</option>
                <option value="trigo">Trigo</option>
                <option value="sorgo">Sorgo</option>
                <option value="algodao">Algodão</option>
              </select>
            </div>
          </div>
        )}

        {passo === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-zinc-300">Quantidade (sacas 60kg)</label>
              <input
                type="number"
                value={qtdSc}
                onChange={(e) => setQtdSc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-300">Preço por saca</label>
              <input
                type="number"
                step="0.01"
                value={precoSc}
                onChange={(e) => setPrecoSc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-300">Moeda</label>
              <select
                value={precoMoeda}
                onChange={(e) => setPrecoMoeda(e.target.value as 'BRL' | 'USD')}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              >
                <option value="BRL">BRL (R$)</option>
                <option value="USD">USD (U$)</option>
              </select>
            </div>
          </div>
        )}

        {passo === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-zinc-300">Origem (UF)</label>
              <input
                maxLength={2}
                value={origem}
                onChange={(e) => setOrigem(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm uppercase text-white"
                placeholder="MT"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-300">Destino (UF)</label>
              <input
                maxLength={2}
                value={destino}
                onChange={(e) => setDestino(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm uppercase text-white"
                placeholder="SP"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-300">Validade (horas)</label>
              <input
                type="number"
                value={validadeHoras}
                onChange={(e) => setValidadeHoras(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={publica}
                onChange={(e) => setPublica(e.target.checked)}
              />
              Publicar no Marketplace (visível para outras corretoras)
            </label>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-300">Observação</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={voltar}
            disabled={passo === 1}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-30"
          >
            Voltar
          </button>
          {passo < 3 ? (
            <button
              type="button"
              onClick={avancar}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Próximo
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={enviar}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? 'Criando…' : 'Criar oferta'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
