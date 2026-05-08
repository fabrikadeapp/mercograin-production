'use client'
import * as React from 'react'
import {
  ResponsiveContainer,
  BarChart as RC,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'

export interface BarChartProps {
  data: Array<{ label: string; value: number }>
  color?: string
  highlightLast?: boolean
  height?: number
  showAxis?: boolean
  showGrid?: boolean
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-bg-2 border border-border-2 rounded-md px-3 py-2 text-small shadow-pop">
      <p className="text-fg-3 text-micro uppercase tracking-wider mb-0.5">{label}</p>
      <p className="t-num text-fg-1 text-body">{payload[0].value}</p>
    </div>
  )
}

export function BarChart({
  data,
  color = 'var(--accent)',
  highlightLast = false,
  height = 240,
  showAxis = true,
  showGrid = true,
}: BarChartProps) {
  const lastIdx = data.length - 1

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RC data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {showGrid ? (
            <CartesianGrid
              stroke="var(--bg-3)"
              strokeDasharray="2 4"
              vertical={false}
            />
          ) : null}
          {showAxis ? (
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--fg-3)', fontSize: 11 }}
            />
          ) : null}
          {showAxis ? (
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--fg-3)', fontSize: 11 }}
              width={32}
            />
          ) : null}
          <Tooltip
            cursor={{ fill: 'var(--bg-3)', opacity: 0.4 }}
            content={<CustomTooltip />}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={color}>
            {highlightLast
              ? data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === lastIdx ? color : `color-mix(in srgb, ${color} 60%, transparent)`}
                  />
                ))
              : null}
          </Bar>
        </RC>
      </ResponsiveContainer>
    </div>
  )
}
