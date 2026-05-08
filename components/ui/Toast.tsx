import React, { useEffect } from 'react'
import clsx from 'clsx'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastProps extends Toast {
  onClose: (id: string) => void
}

const toastConfig: Record<
  ToastType,
  { iconColor: string; borderL: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  success: {
    iconColor: 'text-pos',
    borderL: 'border-l-pos',
    Icon: CheckCircle2,
  },
  error: {
    iconColor: 'text-neg',
    borderL: 'border-l-neg',
    Icon: AlertCircle,
  },
  warning: {
    iconColor: 'text-warn',
    borderL: 'border-l-warn',
    Icon: AlertTriangle,
  },
  info: {
    iconColor: 'text-info',
    borderL: 'border-l-info',
    Icon: Info,
  },
}

function Toast({ id, message, type, duration = 4000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), duration)
    return () => clearTimeout(timer)
  }, [id, duration, onClose])

  const config = toastConfig[type]
  const { Icon } = config

  return (
    <div
      className={clsx(
        'flex items-start gap-3 px-4 py-3 rounded-md border border-border-1 border-l-2 bg-bg-2 text-fg-1 shadow-pop animate-in fade-in slide-in-from-top-2 duration-300',
        config.borderL
      )}
      role="alert"
    >
      <Icon className={clsx('h-5 w-5 shrink-0 mt-0.5', config.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-small font-medium text-fg-1">{message}</p>
      </div>
      <button
        onClick={() => onClose(id)}
        className="text-fg-3 hover:text-fg-1 transition-colors"
        aria-label="Fechar notificação"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onClose: (id: string) => void
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

export function ToastContainer({ toasts, onClose, position = 'top-right' }: ToastContainerProps) {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  }

  return (
    <div className={clsx('fixed z-50 flex flex-col gap-2 max-w-sm pointer-events-auto', positionClasses[position])}>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  )
}
