'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

export type Periodo = 'hoje' | '7d' | '15d' | '30d' | 'custom'
export type Commodity = 'todas' | 'soja' | 'milho' | 'trigo'

export interface DashboardFiltersState {
  periodo: Periodo
  commodity: Commodity
  customRange: { start: string; end: string } | null
}

/**
 * Constrói a query string canônica usada nas chamadas a /api/dashboard/resumo,
 * /api/bhgrain/clientes-radar, etc. Sempre a mesma string para os mesmos
 * filtros → garante que o cache do useJson dê hit entre cards.
 */
export function buildFiltrosQS(state: DashboardFiltersState): string {
  const sp = new URLSearchParams()
  sp.set('periodo', state.periodo)
  if (state.commodity !== 'todas') sp.set('commodity', state.commodity)
  if (state.periodo === 'custom' && state.customRange) {
    sp.set('dataInicio', state.customRange.start)
    sp.set('dataFim', state.customRange.end)
  }
  return sp.toString()
}

interface ContextValue extends DashboardFiltersState {
  /** Query string já formatada para concat em URL: '?periodo=30d&commodity=soja' */
  qs: string
  /** Mesma coisa mas só os params (sem '?') — para append em URLs que já têm ? */
  params: string
}

const DashboardFiltersContext = createContext<ContextValue | null>(null)

export function DashboardFiltersProvider({
  state,
  children,
}: {
  state: DashboardFiltersState
  children: ReactNode
}) {
  const value = useMemo<ContextValue>(() => {
    const params = buildFiltrosQS(state)
    return {
      ...state,
      qs: params ? `?${params}` : '',
      params,
    }
  }, [state])

  return (
    <DashboardFiltersContext.Provider value={value}>{children}</DashboardFiltersContext.Provider>
  )
}

export function useDashboardFilters(): ContextValue {
  const ctx = useContext(DashboardFiltersContext)
  if (!ctx) {
    // Fallback seguro quando o card é usado fora do dashboard
    return { periodo: '30d', commodity: 'todas', customRange: null, qs: '', params: '' }
  }
  return ctx
}
