'use client'

import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

/**
 * GlowButton — botão com gradiente sutil + barra lateral de glow.
 *
 * Cor default = accent do sistema (lime).
 * Variantes de cor são automáticas via CSS vars `--accent`, `--info`, `--warning`, `--danger`, `--success`.
 *
 * Uso:
 *   <GlowButton onClick={...}>Nova proposta</GlowButton>
 *   <GlowButton href="/clientes/novo">Novo cliente</GlowButton>
 *   <GlowButton color="info">Conciliar</GlowButton>
 */

type GlowColor = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const COLOR_VAR: Record<GlowColor, string> = {
  accent: 'var(--accent, #c8f051)',
  success: 'var(--success, #40c864)',
  warning: 'var(--warning, #ffb400)',
  danger: 'var(--danger, #ff5050)',
  info: 'var(--info, #45a3ff)',
  neutral: 'var(--text, #ffffff)',
}

type BaseProps = {
  children: React.ReactNode
  className?: string
  color?: GlowColor
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  /** Ícone à esquerda */
  icon?: React.ReactNode
}

type ButtonProps = BaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'children'> & {
    href?: undefined
  }

type LinkProps = BaseProps & {
  href: string
  onClick?: undefined
  type?: undefined
  disabled?: undefined
}

type Props = ButtonProps | LinkProps

export function GlowButton(props: Props) {
  const {
    children,
    className,
    color = 'accent',
    size = 'md',
    fullWidth,
    icon,
    ...rest
  } = props as ButtonProps & { href?: string }

  const glowColor = COLOR_VAR[color]

  const sizeClass = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-5 text-sm',
    lg: 'h-12 px-6 text-base',
  }[size]

  const inner = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        position: 'relative',
        zIndex: 30,
      }}
    >
      {icon && (
        <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
      )}
      {children}
    </span>
  )

  const classes = cn(
    sizeClass,
    fullWidth && 'w-full',
    // base
    'inline-flex items-center justify-center rounded-md border relative transition-colors overflow-hidden whitespace-nowrap font-medium',
    // gradient bg (top-down)
    'bg-gradient-to-t from-[var(--surface-2)] to-[var(--surface-1)] text-[var(--text)]',
    'border-[var(--border)] hover:text-[var(--text-mute)]',
    'cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
    // after: gradient lateral suave
    'after:absolute after:inset-0 after:rounded-[inherit] after:bg-gradient-to-r after:from-transparent after:from-40% after:via-[var(--glow-via)] after:to-[var(--glow-to)] after:via-70%',
    // before: barra lateral acesa
    'before:absolute before:w-[5px] hover:before:translate-x-full before:transition-all before:duration-200 before:h-[60%] before:right-0 before:rounded-l before:z-10',
    'before:bg-[var(--glow)] before:shadow-[-2px_0_10px_var(--glow)]',
    className,
  )

  const style = {
    '--glow': glowColor,
    '--glow-via': `color-mix(in srgb, ${glowColor} 8%, transparent)`,
    '--glow-to': `color-mix(in srgb, ${glowColor} 22%, transparent)`,
  } as React.CSSProperties

  if ('href' in props && props.href) {
    return (
      <Link href={props.href} className={classes} style={style}>
        {inner}
      </Link>
    )
  }

  return (
    <button
      type="button"
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      className={classes}
      style={style}
    >
      {inner}
    </button>
  )
}
