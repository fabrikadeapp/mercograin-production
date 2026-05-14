import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  actions?: ReactNode
}

/**
 * Insight bar NewDB v2 — barra de 1 linha "what to do now" da IA.
 * Estilo lime translúcido. CSS class .insight em newdb.css.
 */
export function InsightBar({ icon, title, description, actions }: Props) {
  return (
    <div className="insight">
      {icon && <div className="ic">{icon}</div>}
      <div>
        <div className="ttl">{title}</div>
        {description && <div className="desc">{description}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}
