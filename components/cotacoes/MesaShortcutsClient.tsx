'use client'
/**
 * S10 M2 — Wrapper client-side que conecta SSE e renderiza o helper de atalhos.
 * Isolado para que /cotacoes/page.tsx siga server component.
 */
import * as React from 'react'
import { useLiveQuotesSSE } from '@/lib/quotes/useLiveQuotesSSE'
import { AtalhosTecladoHelper } from './AtalhosTecladoHelper'

export function MesaShortcutsClient() {
  // Conecta SSE só pra obter status do transporte (snapshot ignorado aqui).
  const { transport } = useLiveQuotesSSE()
  return <AtalhosTecladoHelper sseTransport={transport} />
}
