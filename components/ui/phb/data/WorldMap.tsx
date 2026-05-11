'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface WorldMapPoint {
  id: string
  label: string
  /** longitude -180..180 */
  lng: number
  /** latitude -90..90 */
  lat: number
  value?: string | number
  color?: string
}

export interface WorldMapProps {
  className?: string
  size?: number
  points?: WorldMapPoint[]
}

const DEFAULT_POINTS: WorldMapPoint[] = [
  { id: 'cn', label: 'China', lng: 104, lat: 35 },
  { id: 'eu', label: 'União Europeia', lng: 10, lat: 50 },
  { id: 'ar', label: 'Argentina', lng: -64, lat: -34 },
  { id: 'us', label: 'EUA', lng: -98, lat: 39 },
  { id: 'in', label: 'Índia', lng: 78, lat: 22 },
  { id: 'br', label: 'Brasil', lng: -52, lat: -10 },
]

const VB_W = 360
const VB_H = 180

function project(lng: number, lat: number): { x: number; y: number } {
  return {
    x: ((lng + 180) / 360) * VB_W,
    y: ((90 - lat) / 180) * VB_H,
  }
}

// Path simplificado dos continentes (equirectangular). Suficiente pra contexto visual.
const WORLD_PATH = [
  // América do Norte
  'M30,55 L52,42 L78,40 L92,48 L98,62 L92,72 L78,80 L62,78 L48,72 L36,68 Z',
  // América Central + Caribe
  'M70,82 L82,85 L86,92 L78,96 L72,92 Z',
  // América do Sul
  'M88,98 L102,96 L114,105 L118,122 L112,140 L102,150 L92,148 L86,135 L84,118 Z',
  // Europa
  'M168,52 L188,48 L198,54 L196,62 L182,66 L170,62 Z',
  // África
  'M178,72 L200,68 L214,78 L218,100 L212,120 L200,134 L186,132 L176,118 L172,94 Z',
  // Oriente Médio + Ásia Central
  'M204,62 L228,56 L246,62 L244,76 L228,82 L210,78 Z',
  // Ásia (continental) + Sibéria
  'M210,40 L260,36 L300,40 L320,52 L322,68 L300,76 L270,72 L240,68 L218,58 Z',
  // Sudeste asiático + Índia
  'M242,82 L264,80 L278,92 L274,104 L258,108 L246,98 Z',
  // Austrália
  'M296,124 L322,122 L330,134 L322,144 L304,144 L294,136 Z',
  // Indonésia / arquipélagos
  'M278,114 L296,112 L298,120 L286,124 L278,120 Z',
].join(' ')

export function WorldMap({
  className,
  size = 220,
  points = DEFAULT_POINTS,
}: WorldMapProps) {
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{
        width: size,
        height: size * (VB_H / VB_W),
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(232,238,240,0.4) 100%)',
        border: '1px solid var(--border-1)',
        borderRadius: 'var(--r-md)',
      }}
      aria-label="Mapa de destinos de exportação"
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d={WORLD_PATH}
          fill="var(--bg-inset)"
          stroke="var(--border-2)"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />
        {points.map((p) => {
          const { x, y } = project(p.lng, p.lat)
          const color = p.color || 'var(--accent)'
          return (
            <g key={p.id}>
              <circle cx={x} cy={y} r="4.5" fill={color} fillOpacity="0.22" />
              <circle cx={x} cy={y} r="2.2" fill={color}>
                <title>{p.label}</title>
              </circle>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
