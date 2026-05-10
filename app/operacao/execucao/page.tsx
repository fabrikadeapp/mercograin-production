/**
 * Dashboard de execução: contratado vs executado em tempo real.
 *
 * Filtros: cultura, faixa percentual.
 * Cards: % executado geral, contratos em atraso, contratos concluídos.
 */
'use client'

import { useEffect, useState } from 'react'

interface Linha {
  contratoId: string
  numero: string
  cliente: string
  cultura: string
  modalidade: string
  tipo: string
  qtdContratoSc: number
  qtdExecutadoSc: number
  pctExecutado: number
  emAtraso: boolean
  dataInicio: string
  dataFim: string | null
}

interface Resumo {
  totalContratos: number
  contratosEmAtraso: number
  contratosConcluidos: number
  totalContratoSc: number
  totalExecutadoSc: number
  pctGeral: number
}

export default function ExecucaoPage() {
  const [data, setData] = useState<{ resumo: Resumo; linhas: Linha[] } | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [cultura, setCultura] = useState<string>('')
  const [minPct, setMinPct] = useState('')
  const [maxPct, setMaxPct] = useState('')

  async function fetchData() {
    setLoading(true)
    setErro(null)
    try {
      const qs = new URLSearchParams()
      if (cultura) qs.set('cultura', cultura)
      if (minPct) qs.set('minPct', minPct)
      if (maxPct) qs.set('maxPct', maxPct)
      const res = await fetch(`/api/operacao/execucao?${qs.toString()}`)
      if (!res.ok) throw new Error('Falha ao carregar')
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      setErro(e?.message || 'Erro')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const r = data?.resumo

  return (
    <main className="mx-auto max-w-7xl p-6 text-fg-1">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Execução de contratos</h1>
          <p className="text-sm text-fg-3 mt-1">
            Contratado vs executado em tempo real · atualiza a cada 30s
          </p>
        </div>
        <button
          onClick={fetchData}
          className="rounded-md bg-bg-3 px-3 py-1.5 text-sm hover:bg-bg-2"
        >
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </header>

      {erro && (
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {erro}
        </div>
      )}

      {/* Cards resumo */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card label="% executado geral" value={`${r?.pctGeral ?? 0}%`} />
        <Card
          label="Contratos ativos"
          value={String(r?.totalContratos ?? 0)}
        />
        <Card
          label="Em atraso"
          value={String(r?.contratosEmAtraso ?? 0)}
          tone={r?.contratosEmAtraso ? 'danger' : undefined}
        />
        <Card
          label="Concluídos"
          value={String(r?.contratosConcluidos ?? 0)}
          tone="success"
        />
      </section>

      {/* Filtros */}
      <section className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Cultura">
          <select
            value={cultura}
            onChange={(e) => setCultura(e.target.value)}
            className="rounded-md bg-bg-2 border border-bg-3 px-2 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            <option value="soja">Soja</option>
            <option value="milho">Milho</option>
            <option value="trigo">Trigo</option>
          </select>
        </Field>
        <Field label="% mín">
          <input
            type="number"
            value={minPct}
            onChange={(e) => setMinPct(e.target.value)}
            className="w-20 rounded-md bg-bg-2 border border-bg-3 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="% máx">
          <input
            type="number"
            value={maxPct}
            onChange={(e) => setMaxPct(e.target.value)}
            className="w-20 rounded-md bg-bg-2 border border-bg-3 px-2 py-1.5 text-sm"
          />
        </Field>
        <button
          onClick={fetchData}
          className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm text-white"
        >
          Filtrar
        </button>
      </section>

      {/* Tabela */}
      <section className="rounded-lg border border-bg-3 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-2 text-xs uppercase text-fg-3">
            <tr>
              <th className="px-3 py-2 text-left">Contrato</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Cultura</th>
              <th className="px-3 py-2 text-right">Contratado (sc)</th>
              <th className="px-3 py-2 text-right">Executado (sc)</th>
              <th className="px-3 py-2 text-left w-1/3">Progresso</th>
            </tr>
          </thead>
          <tbody>
            {(data?.linhas || []).map((l) => (
              <tr
                key={l.contratoId}
                className="border-t border-bg-3 hover:bg-bg-2/40"
              >
                <td className="px-3 py-2 font-medium">#{l.numero}</td>
                <td className="px-3 py-2">{l.cliente}</td>
                <td className="px-3 py-2 capitalize">{l.cultura}</td>
                <td className="px-3 py-2 text-right">
                  {l.qtdContratoSc.toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2 text-right">
                  {l.qtdExecutadoSc.toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2">
                  <ProgressBar pct={l.pctExecutado} atraso={l.emAtraso} />
                </td>
              </tr>
            ))}
            {data && data.linhas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-fg-3">
                  Nenhum contrato encontrado pros filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  )
}

function Card({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'danger'
}) {
  const ring =
    tone === 'success'
      ? 'ring-emerald-500/40'
      : tone === 'danger'
        ? 'ring-red-500/40'
        : 'ring-bg-3'
  return (
    <div className={`rounded-lg bg-bg-2 px-4 py-3 ring-1 ${ring}`}>
      <p className="text-xs uppercase tracking-wider text-fg-3">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col text-xs text-fg-3">
      <span className="mb-1">{label}</span>
      {children}
    </label>
  )
}

function ProgressBar({ pct, atraso }: { pct: number; atraso: boolean }) {
  const safe = Math.min(100, Math.max(0, pct))
  const color =
    pct >= 100
      ? 'bg-emerald-500'
      : atraso
        ? 'bg-red-500'
        : pct >= 75
          ? 'bg-emerald-500'
          : pct >= 40
            ? 'bg-yellow-500'
            : 'bg-blue-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-bg-3 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${safe}%` }} />
      </div>
      <span className="text-xs tabular-nums w-12 text-right">
        {safe.toFixed(1)}%
      </span>
    </div>
  )
}
