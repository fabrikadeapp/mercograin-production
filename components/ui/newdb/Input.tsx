import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  /** Conteúdo antes do input (R$, ícone, etc). Renomeado de 'prefix' para evitar conflito com atributo HTML. */
  leading?: ReactNode
  /** Conteúdo após o input (kbd ⌘K, etc) */
  trailing?: ReactNode
  wrapperClassName?: string
}

/** Input NewDB v2 — wrapper .input com leading/trailing opcionais. */
export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { leading, trailing, wrapperClassName, className, ...rest },
  ref
) {
  const wrap = ['input']
  if (wrapperClassName) wrap.push(wrapperClassName)
  return (
    <div className={wrap.join(' ')}>
      {leading && <span className="pre">{leading}</span>}
      <input ref={ref} className={className} {...rest} />
      {trailing && <span className="post">{trailing}</span>}
    </div>
  )
})
