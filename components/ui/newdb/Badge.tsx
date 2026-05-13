import type { ReactNode } from 'react'

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'

interface Props {
  tone?: BadgeTone
  children: ReactNode
  /** Renderiza dot indicator (default: true para tones com cor) */
  withDot?: boolean
  className?: string
}

/** Badge NewDB v2 — usa classes .badge.{success|warning|danger|info|neutral} de newdb.css */
export function Badge({ tone = 'neutral', children, withDot, className }: Props) {
  const showDot = withDot ?? tone !== 'neutral'
  const classes = ['badge']
  if (tone === 'success') classes.push('success')
  else if (tone === 'warning') classes.push('warning')
  else if (tone === 'danger') classes.push('danger')
  else if (tone === 'info') classes.push('info')
  else if (tone === 'neutral') classes.push('neutral')
  // 'accent' (lime) não está no CSS base — usa style inline:
  const accentStyle =
    tone === 'accent'
      ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'rgba(200,240,81,0.35)' }
      : undefined
  if (className) classes.push(className)
  return (
    <span className={classes.join(' ')} style={accentStyle}>
      {showDot && <span className="dot" />}
      {children}
    </span>
  )
}
