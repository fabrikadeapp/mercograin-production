'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface SparklineProps {
  data: number[]
  color?: string
  fillGradient?: boolean
  width?: number
  height?: number
  smooth?: boolean
  className?: string
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  if (points.length === 1) {
    const p = points[0]
    return `M ${p.x},${p.y}`
  }
  let d = `M ${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    // Catmull-Rom to Bezier
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

function buildLinearPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`)
    .join(' ')
}

export function Sparkline({
  data,
  color = 'var(--accent)',
  fillGradient = true,
  width,
  height = 48,
  smooth = true,
  className,
}: SparklineProps) {
  const uid = React.useId().replace(/:/g, '')
  const gradId = `sparkline-grad-${uid}`

  if (!data || data.length === 0) {
    return (
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className={cn('block w-full', className)}
        style={width ? { width } : undefined}
        height={height}
        aria-hidden="true"
      />
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padY = 2
  const usableH = height - padY * 2
  const step = data.length > 1 ? 100 / (data.length - 1) : 0

  const points = data.map((v, i) => ({
    x: data.length === 1 ? 50 : i * step,
    y: padY + usableH - ((v - min) / range) * usableH,
  }))

  const linePath = smooth ? buildSmoothPath(points) : buildLinearPath(points)
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`
      : ''

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={cn('block w-full', className)}
      style={width ? { width } : undefined}
      height={height}
      aria-hidden="true"
    >
      {fillGradient ? (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
      ) : null}
      {fillGradient && areaPath ? (
        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      ) : null}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
