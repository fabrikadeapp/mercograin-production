import type { ReactNode } from 'react'

interface Props {
  /** Variante hero = lime gradient; standard = glass */
  hero?: boolean
  icon?: ReactNode
  title: string
  /** Valor principal (number ou string já formatada) */
  value: ReactNode
  /** Prefixo monetário "R$" ou similar (opcional) */
  currency?: string
  /** Delta com % e descrição contextual */
  delta?: {
    pct: number | null
    /** "▲" / "▼" derivado do sinal de pct */
    label?: string
  }
  /** SVG sparkline (opcional, posicionado em absolute bottom-right) */
  spark?: ReactNode
  className?: string
}

/**
 * KPI NewDB v2 — usa .kpi / .kpi.hero / .head / .val / .delta / .spark.
 * Hero: lime BG, valor grande. Standard: glass.
 */
export function KpiCard({ hero, icon, title, value, currency, delta, spark, className }: Props) {
  const classes = ['kpi']
  if (hero) classes.push('hero')
  if (className) classes.push(className)

  const deltaDir = delta?.pct == null ? null : delta.pct >= 0 ? 'up' : 'down'
  const deltaArrow = deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : ''
  const deltaPctStr =
    delta?.pct != null
      ? `${deltaArrow} ${Math.abs(delta.pct).toFixed(1).replace('.', ',')}%`
      : '—'

  return (
    <div className={classes.join(' ')}>
      <div className="head">
        {icon && (
          <div className="icn" style={hero ? { color: 'var(--accent)' } : undefined}>
            {icon}
          </div>
        )}
        <div className="ttl">{title}</div>
      </div>
      <div className="val">
        {currency && <span className="currency">{currency}</span>}
        <span className="t-num">{value}</span>
      </div>
      {delta && (
        <div className="delta">
          {deltaDir && <span className={`pct ${deltaDir}`}>{deltaPctStr}</span>}
          {delta.label && <span>{delta.label}</span>}
        </div>
      )}
      {spark && <div className="spark">{spark}</div>}
    </div>
  )
}
