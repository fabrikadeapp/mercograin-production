import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Renderiza chevron à direita */
  withArrow?: boolean
  /** Ícone à esquerda do label */
  leftIcon?: ReactNode
}

/**
 * Botão NewDB v2 — usa classes .btn / .btn.primary / .btn.ghost / .btn.danger / .btn.icon
 * de styles/newdb.css. Estados (hover/focus/disabled) vêm do CSS.
 *
 * Tamanhos via padding extra; o CSS base é o size 'md'.
 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', size = 'md', withArrow, leftIcon, className, children, ...rest },
  ref
) {
  const classes = ['btn']
  if (variant === 'primary') classes.push('primary')
  if (variant === 'ghost') classes.push('ghost')
  if (variant === 'danger') classes.push('danger')
  if (variant === 'icon') classes.push('icon')

  // Sizes ajustam padding/font sem mudar a aparência base.
  const sizeStyle =
    size === 'sm'
      ? { padding: variant === 'icon' ? '0' : '6px 10px', fontSize: 12 }
      : size === 'lg'
        ? { padding: variant === 'icon' ? '0' : '11px 18px', fontSize: 14 }
        : undefined

  if (className) classes.push(className)
  return (
    <button ref={ref} className={classes.join(' ')} style={sizeStyle} {...rest}>
      {leftIcon}
      {children}
      {withArrow && (
        <span className="ar" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      )}
    </button>
  )
})
