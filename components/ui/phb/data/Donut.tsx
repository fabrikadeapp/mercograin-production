'use client'
import * as React from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export interface DonutDatum {
  label: string
  value: number
  color?: string
}

export interface DonutProps {
  data: DonutDatum[]
  centerLabel?: string
  centerValue?: string
  centerSubtitle?: string
  size?: number
  showLegend?: boolean
}

const DEFAULT_COLORS = [
  'var(--accent)',
  'var(--grain-milho)',
  'var(--grain-trigo)',
  'var(--grain-soja)',
  'var(--info)',
]

export function Donut({
  data,
  centerValue,
  centerLabel,
  centerSubtitle,
  size = 200,
  showLegend = true,
}: DonutProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1
  const computedCenterValue =
    centerValue ?? `${Math.round(((data[0]?.value ?? 0) / total) * 100)}%`
  const computedSubtitle = centerSubtitle ?? data[0]?.label

  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="65%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="var(--bg-2)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="t-num-lg text-fg-1">{computedCenterValue}</p>
          {(centerLabel || computedSubtitle) ? (
            <p className="eyebrow mt-1">{centerLabel ?? computedSubtitle}</p>
          ) : null}
        </div>
      </div>
      {showLegend ? (
        <ul className="flex-1 space-y-2 min-w-0">
          {data.map((d, i) => (
            <li
              key={i}
              className="flex items-center gap-3 text-small"
            >
              <span
                className="h-2 w-2 rounded-sm shrink-0"
                style={{
                  background: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
                }}
              />
              <span className="text-fg-2 flex-1 truncate">{d.label}</span>
              <span className="t-num text-fg-1">{d.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
