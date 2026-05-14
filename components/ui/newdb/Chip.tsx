import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  children: ReactNode
}

/** Chip NewDB v2 — filter chip. .chip.active = lime BG. */
export function Chip({ active, className, children, ...rest }: Props) {
  const classes = ['chip']
  if (active) classes.push('active')
  if (className) classes.push(className)
  return (
    <button type="button" className={classes.join(' ')} {...rest}>
      {children}
    </button>
  )
}
