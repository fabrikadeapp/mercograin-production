import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Conteúdo à direita (ex: botão "Filtros avançados") */
  right?: ReactNode
  className?: string
}

/** Filter bar NewDB v2 — pílula horizontal glass com chips de período/commodity. */
export function FilterBar({ children, right, className }: Props) {
  const classes = ['filter-bar']
  if (className) classes.push(className)
  return (
    <div className={classes.join(' ')}>
      {children}
      {right && <div className="sep" style={{ marginLeft: 'auto' }} />}
      {right}
    </div>
  )
}

/** Label dentro do FilterBar (PERÍODO, COMMODITY, etc) */
export function FilterLabel({ children }: { children: ReactNode }) {
  return <span className="label">{children}</span>
}

/** Separador vertical dentro do FilterBar */
export function FilterSep() {
  return <div className="sep" />
}
