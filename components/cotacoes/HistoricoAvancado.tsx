'use client'
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/phb/data/Card'
import { Chip } from '@/components/ui/phb/primitives/Chip'
import { Button } from '@/components/ui/phb/primitives/Button'
import { GrainBadge } from '@/components/ui/phb/primitives/Badge'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { Download } from 'lucide-react'

type Periodo = '7d' | '30d' | '90d' | '1y' | 'all'
type Grao = 'soja' | 'milho' | 'trigo'

interface ResumoSerie {
  inicio: number | null
  atual: number | null
  minimo: number | null
  maximo: number | null
  variacaoPct: number | null
  media: number | null
  pontosTotais: number
}

interface ApiResponse {
  dados: Array<Record<string, number | string | null>>
  resumos: Record<string, ResumoSerie>
  periodo: Periodo
  graos: Grao[]
  mediaMovel: number[]
}

const PERIODOS: { v: Periodo; label: string }[] = [
  { v: '7d', label: '7 dias' },
  { v: '30d', label: '30 dias' },
  { v: '90d', label: '90 dias' },
  { v: '1y', label: '1 ano' },
  { v: 'all', label: 'Tudo' },
]

const GRAOS: { v: Grao; label: string; color: string }[] = [
  { v: 'soja', label: 'Soja', color: 'var(--grain-soja)' },
  { v: 'milho', label: 'Milho', color: 'var(--grain-milho)' },
  { v: 'trigo', label: 'Trigo', color: 'var(--grain-trigo)' },
]

export function HistoricoAvancado() {
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [graos, setGraos] = useState<Grao[]>(['soja'])
  const [mediaMovel, setMediaMovel] = useState<number[]>([])
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (graos.length === 0) {
      setData({ dados: [], resumos: {}, periodo, graos: [], mediaMovel })
      return
    }
    setLoading(true)
    const params = new URLSearchParams({
      graos: graos.join(','),
      periodo,
    })
    if (mediaMovel.length) params.set('mm', mediaMovel.join(','))
    fetch(`/api/cotacoes/historico-db?${params}`)
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [periodo, graos, mediaMovel])

  function toggleGrao(g: Grao) {
    setGraos((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  function toggleMM(j: number) {
    setMediaMovel((prev) => (prev.includes(j) ? prev.filter((x) => x !== j) : [...prev, j]))
  }

  function exportCsv() {
    if (!data?.dados.length) return
    const cols = Object.keys(data.dados[0])
    const lines = [cols.join(',')]
    for (const row of data.dados) {
      lines.push(cols.map((c) => row[c] ?? '').join(','))
    }
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cotacoes-${periodo}-${graos.join('+')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Build flat array of <Line> elements (Recharts requires direct children, not fragments)
  const lineElements = graos.flatMap((g) => {
    const meta = GRAOS.find((x) => x.v === g)!
    const elems = [
      <Line
        key={g}
        type="monotone"
        dataKey={g}
        name={meta.label}
        stroke={meta.color}
        strokeWidth={2}
        dot={false}
        isAnimationActive={false}
        connectNulls
      />,
    ]
    for (const mm of mediaMovel) {
      elems.push(
        <Line
          key={`${g}-mm${mm}`}
          type="monotone"
          dataKey={`${g}MM${mm}`}
          name={`${meta.label} MM${mm}`}
          stroke={meta.color}
          strokeWidth={1.2}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />,
      )
    }
    return elems
  })

  return (
    <Card className="p-6 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          {PERIODOS.map((p) => (
            <Chip
              key={p.v}
              variant={periodo === p.v ? 'pos' : 'neutral'}
              onClick={() => setPeriodo(p.v)}
              className="cursor-pointer"
            >
              {p.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {GRAOS.map((g) => (
            <button
              key={g.v}
              onClick={() => toggleGrao(g.v)}
              className={`text-small px-3 py-1 rounded-pill border transition ${
                graos.includes(g.v)
                  ? 'border-fg-1 bg-fg-1/5'
                  : 'border-border-1 text-fg-3 hover:text-fg-1'
              }`}
              style={graos.includes(g.v) ? { color: g.color } : {}}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {[9, 21].map((j) => (
            <Chip
              key={j}
              variant={mediaMovel.includes(j) ? 'pos' : 'neutral'}
              onClick={() => toggleMM(j)}
              className="cursor-pointer"
            >
              MM{j}
            </Chip>
          ))}
          <Button onClick={exportCsv} variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Gráfico */}
      <div className="h-80">
        {loading && <div className="text-fg-3 text-small">Carregando…</div>}
        {!loading && data && data.dados.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.dados} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="var(--border-1)" strokeDasharray="3 3" />
              <XAxis
                dataKey="data"
                tick={{ fill: 'var(--fg-3)', fontSize: 11 }}
                tickFormatter={(v: string) => (v ? v.slice(5).replace('-', '/') : '')}
              />
              <YAxis
                tick={{ fill: 'var(--fg-3)', fontSize: 11 }}
                tickFormatter={(v: number) => `R$ ${v.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border-1)',
                  borderRadius: 8,
                  color: 'var(--fg-1)',
                }}
                labelFormatter={(label) => String(label ?? '')}
                formatter={(v, name) => [
                  typeof v === 'number' ? `R$ ${v.toFixed(2)}` : String(v ?? ''),
                  String(name ?? ''),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {lineElements}
            </LineChart>
          </ResponsiveContainer>
        )}
        {!loading && data && data.dados.length === 0 && (
          <div className="flex items-center justify-center h-full text-fg-3 text-small text-center px-4">
            {graos.length === 0
              ? 'Selecione ao menos um grão.'
              : 'Sem dados no período. O cron diário ainda está populando a base — tente novamente em breve.'}
          </div>
        )}
      </div>

      {/* Resumo */}
      {data && graos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-border-1">
          {graos.map((g) => {
            const r = data.resumos[g]
            if (!r || r.pontosTotais === 0) return null
            const trend = (r.variacaoPct ?? 0) >= 0 ? 'pos' : 'neg'
            const meta = GRAOS.find((x) => x.v === g)!
            return (
              <div key={g} className="space-y-1">
                <p className="eyebrow flex items-center gap-1.5" style={{ color: meta.color }}>
                  <GrainBadge variant={g} /> {meta.label}
                </p>
                <p className="text-small text-fg-3">
                  Atual:{' '}
                  <span className="t-num text-fg-1">R$ {r.atual?.toFixed(2)}</span>
                </p>
                <p className="text-small text-fg-3">
                  Var:{' '}
                  <span className={`t-num ${trend === 'pos' ? 'text-pos' : 'text-neg'}`}>
                    {r.variacaoPct?.toFixed(2)}%
                  </span>
                </p>
                <p className="text-micro text-fg-4">
                  Mín R$ {r.minimo?.toFixed(2)} · Máx R$ {r.maximo?.toFixed(2)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
