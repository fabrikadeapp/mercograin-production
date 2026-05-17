'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Card-link com hover lime border. Client component porque server
 * components não suportam onMouseEnter/Leave.
 *
 * Usado em hubs administrativos (/configuracoes, /admin-empresa).
 */
export function HoverCard({
  href,
  children,
  variant = 'card',
}: {
  href: string
  children: ReactNode
  variant?: 'card' | 'tile' | 'kpi'
}) {
  const baseStyle: React.CSSProperties =
    variant === 'tile'
      ? {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: 12,
          borderRadius: 'var(--r-md)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          textDecoration: 'none',
          color: 'var(--text)',
          minHeight: 72,
          transition: '120ms ease',
        }
      : variant === 'kpi'
        ? {
            display: 'block',
            padding: 14,
            borderRadius: 'var(--r-md)',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            textDecoration: 'none',
            color: 'var(--text)',
            transition: '120ms ease',
          }
        : {
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 16,
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            background: 'var(--surface-1)',
            textDecoration: 'none',
            color: 'var(--text)',
            transition: '120ms ease',
          }

  return (
    <Link
      href={href}
      style={baseStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        if (variant === 'card') e.currentTarget.style.background = 'var(--surface-2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        if (variant === 'card') e.currentTarget.style.background = 'var(--surface-1)'
      }}
    >
      {children}
    </Link>
  )
}

/**
 * Mesma coisa mas pra texto-link com hover de cor (Check items, etc).
 */
export function HoverTextLink({
  href,
  children,
  className,
  style,
  hoverColor = 'var(--accent)',
  baseColor = 'var(--text)',
  done = false,
}: {
  href: string
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  hoverColor?: string
  baseColor?: string
  done?: boolean
}) {
  const restColor = done ? 'var(--text-mute)' : baseColor
  return (
    <Link
      href={href}
      className={className}
      style={{
        textDecoration: 'none',
        transition: 'color 120ms ease',
        color: restColor,
        ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = hoverColor)}
      onMouseLeave={(e) => (e.currentTarget.style.color = restColor)}
    >
      {children}
    </Link>
  )
}
