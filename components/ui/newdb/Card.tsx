import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** glass = backdrop-filter blur; elev = surface-2 */
  variant?: 'default' | 'glass' | 'elev'
  children: ReactNode
}

/** Card NewDB v2 — surface-1 (default), .card.glass ou .card.elev */
export function Card({ variant = 'default', className, children, ...rest }: CardProps) {
  const classes = ['card']
  if (variant === 'glass') classes.push('glass')
  else if (variant === 'elev') classes.push('elev')
  if (className) classes.push(className)
  return (
    <div className={classes.join(' ')} {...rest}>
      {children}
    </div>
  )
}

interface SectionCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass'
  /** Header opcional */
  title?: string
  subtitle?: string
  /** Ações no canto direito do header */
  actions?: ReactNode
  children: ReactNode
}

/**
 * SectionCard NewDB v2 — variante com header (.sec-card / .sec-head) usado
 * em cards do dashboard (Clientes, Inbox, Preços, etc).
 */
export function SectionCard({ variant = 'default', title, subtitle, actions, className, children, ...rest }: SectionCardProps) {
  const classes = ['sec-card']
  if (variant === 'glass') classes.push('glass')
  if (className) classes.push(className)
  return (
    <div className={classes.join(' ')} {...rest}>
      {(title || actions) && (
        <div className="sec-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
