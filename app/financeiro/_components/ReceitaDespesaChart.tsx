'use client'

import { useMemo } from 'react'

interface Props {
  data: Array<{ date: string; receita: number; despesa: number }>
  height?: number
}

const fmtBRL = (n: number) =>
  n >= 1_000_000
    ? `R$ ${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `R$ ${(n / 1_000).toFixed(0)}k`
      : `R$ ${n.toFixed(0)}`

/**
 * Mini gráfico de barras receita vs despesa, 30 dias.
 * SVG puro (sem dependência de lib pesada). Hover mostra valor do dia.
 */
export function ReceitaDespesaChart({ data, height = 160 }: Props) {
  const max = useMemo(() => {
    const all = data.flatMap((d) => [d.receita, d.despesa])
    const m = Math.max(...all, 0)
    return m === 0 ? 1 : m
  }, [data])

  const W = 600
  const barW = W / data.length / 2.4
  const groupW = W / data.length

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
        {/* Grade horizontal (4 linhas) */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={0}
            x2={W}
            y1={height * p}
            y2={height * p}
            stroke="var(--border)"
            strokeDasharray="2 3"
            strokeWidth={0.5}
            opacity={0.5}
          />
        ))}
        {data.map((d, i) => {
          const x = i * groupW
          const hRec = (d.receita / max) * (height - 20)
          const hDes = (d.despesa / max) * (height - 20)
          return (
            <g key={d.date}>
              <title>
                {new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                })}
                {'\n'}Receita: {fmtBRL(d.receita)}
                {'\n'}Despesa: {fmtBRL(d.despesa)}
              </title>
              <rect
                x={x + groupW / 2 - barW - 1}
                y={height - hRec - 4}
                width={barW}
                height={hRec}
                fill="var(--success)"
                opacity={0.85}
                rx={1}
              />
              <rect
                x={x + groupW / 2 + 1}
                y={height - hDes - 4}
                width={barW}
                height={hDes}
                fill="var(--danger)"
                opacity={0.7}
                rx={1}
              />
            </g>
          )
        })}
      </svg>
      <div
        className="flex items-center justify-between"
        style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}
      >
        <span>
          {new Date(data[0]?.date + 'T00:00:00').toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
          })}
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: 'var(--success)',
                display: 'inline-block',
              }}
            />
            Receita
          </span>
          <span className="flex items-center gap-1">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: 'var(--danger)',
                display: 'inline-block',
                opacity: 0.7,
              }}
            />
            Despesa
          </span>
        </span>
        <span>
          {new Date(data[data.length - 1]?.date + 'T00:00:00').toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
          })}
        </span>
      </div>
    </div>
  )
}
