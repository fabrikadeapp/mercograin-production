'use client'
import * as React from 'react'
import {
  ResponsiveContainer,
  AreaChart as RC,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

export interface AreaChartProps {
  data: Array<{ label: string; value: number }>
  color?: string
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

export function AreaChart({
  data,
  color = 'var(--accent)',
  height = 240,
  showAxis = true,
  showGrid = true,
}: AreaChartProps) {
  const uid = React.useId().replace(/:/g, '')
  const gradId = `area-grad-${uid}`

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RC data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            cursor={{ stroke: color, strokeDasharray: '2 4' }}
            content={<CustomTooltip />}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{
              r: 4,
              fill: color,
              stroke: 'var(--bg-0)',
              strokeWidth: 2,
            }}
          />
        </RC>
      </ResponsiveContainer>
    </div>
  )
}
