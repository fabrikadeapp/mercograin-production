'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, AlertTriangle, Clock, CheckCircle2, Target, Eye } from 'lucide-react'
import { Card } from '@/components/ui/phb'
import { formatCurrency } from '@/lib/utils/formatters'

interface KPIs {
  emAberto: { count: number; valor: number }
  vencendoHoje: { count: number; valor: number }
  vencendoEm3d: { count: number; valor: number }
  vencidas: { count: number; valor: number }
  fechadasNoMes: { count: number; valor: number }
  hitRateMensal: number
  taxaVisualizacao: number
}

/**
 * Formata valor monetário grande de forma compacta:
 *   R$ 1.249.018,50 → "R$ 1,2 mi"
 *   R$ 143.200,00  → "R$ 143 mil"
 *   R$ 0,00         → "R$ 0"
 *
 * Critério: usa abreviação quando o card é estreito (KPIs em grade densa).
 */
function formatCurrencyCompact(valor: number): string {
  if (!Number.isFinite(valor)) return 'R$ —'
  const abs = Math.abs(valor)
  if (abs >= 1_000_000) {
    return `R$ ${(valor / 1_000_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} mi`
  }
  if (abs >= 10_000) {
    return `R$ ${(valor / 1_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })} mil`
  }
  if (abs >= 1_000) {
    return `R$ ${(valor / 1_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} mil`
  }
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function PropostasKPIs() {
  const [data, setData] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/propostas/kpis')
      .then((r) => r.json())
      .then((j) => {
        if (j && typeof j === 'object' && 'emAberto' in j) setData(j as KPIs)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="py-3">
            <div className="h-12 animate-pulse bg-bg-3 rounded" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <KPI
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        label="Em aberto"
        valor={formatCurrencyCompact(data.emAberto.valor)}
        valorTitle={formatCurrency(data.emAberto.valor)}
        sub={`${data.emAberto.count} ${data.emAberto.count === 1 ? 'proposta' : 'propostas'}`}
        tom="accent"
      />
      <KPI
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        label="Vencendo hoje"
        valor={data.vencendoHoje.count.toString()}
        sub={formatCurrencyCompact(data.vencendoHoje.valor)}
        subTitle={formatCurrency(data.vencendoHoje.valor)}
        tom={data.vencendoHoje.count > 0 ? 'neg' : 'fg-3'}
      />
      <KPI
        icon={<Clock className="h-3.5 w-3.5" />}
        label="Vencendo em 3d"
        valor={data.vencendoEm3d.count.toString()}
        sub={formatCurrencyCompact(data.vencendoEm3d.valor)}
        subTitle={formatCurrency(data.vencendoEm3d.valor)}
        tom={data.vencendoEm3d.count > 0 ? 'warn' : 'fg-3'}
      />
      <KPI
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        label="Fechadas no mês"
        valor={data.fechadasNoMes.count.toString()}
        sub={formatCurrencyCompact(data.fechadasNoMes.valor)}
        subTitle={formatCurrency(data.fechadasNoMes.valor)}
        tom="pos"
      />
      <KPI
        icon={<Target className="h-3.5 w-3.5" />}
        label="Hit rate"
        valor={`${(data.hitRateMensal * 100).toFixed(0)}%`}
        sub="aprovadas / decididas"
        tom="info"
      />
      <KPI
        icon={<Eye className="h-3.5 w-3.5" />}
        label="Visualização"
        valor={`${(data.taxaVisualizacao * 100).toFixed(0)}%`}
        sub="vistas / enviadas"
        tom="accent"
      />
    </div>
  )
}

interface KPIProps {
  icon: React.ReactNode
  label: string
  valor: string
  /** Tooltip com valor completo (não-abreviado) quando o número foi compactado. */
  valorTitle?: string
  sub: string
  subTitle?: string
  tom: 'accent' | 'neg' | 'warn' | 'pos' | 'info' | 'fg-3'
}

function KPI({ icon, label, valor, valorTitle, sub, subTitle, tom }: KPIProps) {
  const colorMap: Record<string, string> = {
    accent: 'var(--accent)',
    neg: 'var(--danger)',
    warn: 'var(--warn)',
    pos: 'var(--success)',
    info: 'var(--info)',
    'fg-3': 'var(--text-dim)',
  }
  return (
    <Card className="py-3 overflow-hidden min-w-0">
      <div className="flex items-center gap-1.5 mb-1 min-w-0" style={{ color: colorMap[tom] }}>
        <span className="shrink-0">{icon}</span>
        <span
          className="eyebrow truncate"
          style={{ color: colorMap[tom], fontSize: 10 }}
        >
          {label}
        </span>
      </div>
      <p
        className="text-fg-1 tabular-nums leading-tight truncate"
        style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}
        title={valorTitle ?? valor}
      >
        {valor}
      </p>
      <p
        className="text-fg-3 tabular-nums mt-0.5 truncate"
        style={{ fontSize: 10 }}
        title={subTitle ?? sub}
      >
        {sub}
      </p>
    </Card>
  )
}
