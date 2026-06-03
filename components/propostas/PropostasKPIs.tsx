'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, AlertTriangle, Clock, CheckCircle2, Target } from 'lucide-react'
import { Card } from '@/components/ui/phb'
import { formatCurrency } from '@/lib/utils/formatters'

interface KPIs {
  emAberto: { count: number; valor: number }
  vencendoHoje: { count: number; valor: number }
  vencendoEm3d: { count: number; valor: number }
  vencidas: { count: number; valor: number }
  fechadasNoMes: { count: number; valor: number }
  hitRateMensal: number
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} className="py-3">
            <div className="h-12 animate-pulse bg-bg-3 rounded" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <KPI
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        label="Em aberto"
        valor={formatCurrency(data.emAberto.valor)}
        sub={`${data.emAberto.count} propostas`}
        tom="accent"
      />
      <KPI
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        label="Vencendo hoje"
        valor={data.vencendoHoje.count.toString()}
        sub={formatCurrency(data.vencendoHoje.valor)}
        tom={data.vencendoHoje.count > 0 ? 'neg' : 'fg-3'}
      />
      <KPI
        icon={<Clock className="h-3.5 w-3.5" />}
        label="Vencendo em 3d"
        valor={data.vencendoEm3d.count.toString()}
        sub={formatCurrency(data.vencendoEm3d.valor)}
        tom={data.vencendoEm3d.count > 0 ? 'warn' : 'fg-3'}
      />
      <KPI
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        label="Fechadas no mês"
        valor={data.fechadasNoMes.count.toString()}
        sub={formatCurrency(data.fechadasNoMes.valor)}
        tom="pos"
      />
      <KPI
        icon={<Target className="h-3.5 w-3.5" />}
        label="Hit rate mensal"
        valor={`${(data.hitRateMensal * 100).toFixed(0)}%`}
        sub="aprovadas / decididas"
        tom="info"
      />
    </div>
  )
}

interface KPIProps {
  icon: React.ReactNode
  label: string
  valor: string
  sub: string
  tom: 'accent' | 'neg' | 'warn' | 'pos' | 'info' | 'fg-3'
}

function KPI({ icon, label, valor, sub, tom }: KPIProps) {
  const colorMap: Record<string, string> = {
    accent: 'var(--accent)',
    neg: 'var(--danger)',
    warn: 'var(--warn)',
    pos: 'var(--success)',
    info: 'var(--info)',
    'fg-3': 'var(--text-dim)',
  }
  return (
    <Card className="py-3">
      <div className="flex items-center gap-1.5 mb-1" style={{ color: colorMap[tom] }}>
        {icon}
        <span className="eyebrow" style={{ color: colorMap[tom] }}>
          {label}
        </span>
      </div>
      <p className="t-num-lg text-fg-1 tabular-nums leading-tight">{valor}</p>
      <p className="text-fg-3 text-[11px] tabular-nums mt-0.5">{sub}</p>
    </Card>
  )
}
