'use client'

import {
  Plus,
  FileText,
  Users,
  Calculator,
  Sparkles,
  BarChart3,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { GlowButton } from '@/components/ui/GlowButton'
import type { Area } from '@/lib/areas'

interface FunctionItem {
  label: string
  href: string
  icon: LucideIcon
  color?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

const TOOLBARS: Record<Area, FunctionItem[]> = {
  mesa: [
    { label: 'Nova proposta', href: '/propostas/nova', icon: Plus, color: 'accent' },
    { label: 'Novo cliente', href: '/clientes/novo', icon: Users },
    { label: 'Calculadora', href: '/calculadora', icon: Calculator },
    { label: 'Laura.IA', href: '/laura', icon: Sparkles, color: 'info' },
  ],
  financeiro: [
    {
      label: 'Lançar receita',
      href: '/financeiro/movimentos/novo?tipo=receita',
      icon: TrendingUp,
      color: 'success',
    },
    {
      label: 'Lançar despesa',
      href: '/financeiro/movimentos/novo?tipo=despesa',
      icon: TrendingUp,
      color: 'danger',
    },
    { label: 'Comissões', href: '/financeiro/comissoes', icon: BarChart3 },
    { label: 'Conciliação', href: '/financeiro/conciliacao', icon: FileText },
  ],
  fiscal: [
    { label: 'Nova nota', href: '/fiscal/notas/nova', icon: Plus, color: 'accent' },
    { label: 'SPED', href: '/fiscal/sped', icon: FileText },
    { label: 'EUDR', href: '/eudr', icon: FileText, color: 'info' },
  ],
  gestao: [
    { label: 'Adicionar membro', href: '/gestao/equipe', icon: Plus, color: 'accent' },
    { label: 'Configurações', href: '/configuracoes', icon: FileText },
    { label: 'C-Level BI', href: '/relatorios/clevel', icon: BarChart3 },
  ],
}

export function FunctionToolbar({ area }: { area: Area }) {
  const items = TOOLBARS[area] ?? []
  if (items.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        margin: '6px 0 14px',
      }}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <GlowButton
            key={item.href}
            href={item.href}
            color={item.color}
            size="sm"
            icon={<Icon style={{ width: 14, height: 14 }} />}
          >
            {item.label}
          </GlowButton>
        )
      })}
    </div>
  )
}
