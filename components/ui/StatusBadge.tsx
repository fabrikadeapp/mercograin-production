import React from 'react'
import clsx from 'clsx'

type StatusType = 'rascunho' | 'enviada' | 'aceita' | 'rejeitada' | 'ativo' | 'inativo' | 'aberto' | 'pago' | 'vencido' | 'cancelado' | 'assinado' | 'pendente' | 'success' | 'error' | 'warning' | 'info'

interface StatusBadgeProps {
  status: StatusType | string
  className?: string
}

const statusColorMap: Record<StatusType, { bg: string; text: string; icon: string }> = {
  rascunho: { bg: 'bg-gray-100', text: 'text-gray-700', icon: '📝' },
  enviada: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '📤' },
  aceita: { bg: 'bg-green-100', text: 'text-green-700', icon: '✅' },
  rejeitada: { bg: 'bg-red-100', text: 'text-red-700', icon: '❌' },
  ativo: { bg: 'bg-green-100', text: 'text-green-700', icon: '✅' },
  inativo: { bg: 'bg-gray-100', text: 'text-gray-700', icon: '⏸️' },
  aberto: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '📂' },
  pago: { bg: 'bg-green-100', text: 'text-green-700', icon: '💚' },
  vencido: { bg: 'bg-red-100', text: 'text-red-700', icon: '⏰' },
  cancelado: { bg: 'bg-gray-100', text: 'text-gray-700', icon: '🚫' },
  assinado: { bg: 'bg-green-100', text: 'text-green-700', icon: '✍️' },
  pendente: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '⏳' },
  success: { bg: 'bg-green-100', text: 'text-green-700', icon: '✅' },
  error: { bg: 'bg-red-100', text: 'text-red-700', icon: '❌' },
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '⚠️' },
  info: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'ℹ️' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorConfig = statusColorMap[status as StatusType] || statusColorMap.info
  const displayText = status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold',
        colorConfig.bg,
        colorConfig.text,
        className
      )}
    >
      <span>{colorConfig.icon}</span>
      {displayText}
    </span>
  )
}
