'use client'

import { useState } from 'react'
import { ClienteCommandBar } from './ClienteCommandBar'
import { PropostaFormPainel } from './PropostaFormPainel'
import type { ClienteCriado } from '@/components/clientes/ClienteForm'

interface Cliente {
  id: string
  nome: string
}

export interface NovaPropostaFluxoProps {
  clientes: Cliente[]
  marginsMap: Record<string, number>
  onClienteCriado?: (cliente: ClienteCriado) => void
}

/**
 * Orquestrador de 2 etapas para criar uma proposta:
 *   Etapa 1 (ClienteCommandBar) → escolher/criar cliente.
 *   Etapa 2 (PropostaFormPainel) → preencher tipo, grão, qtd, preço, validade.
 *
 * Estado mínimo: cliente selecionado (null = etapa 1).
 */
export function NovaPropostaFluxo({
  clientes,
  marginsMap,
  onClienteCriado,
}: NovaPropostaFluxoProps) {
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)

  if (!clienteSelecionado) {
    return (
      <ClienteCommandBar
        clientes={clientes}
        onSelected={setClienteSelecionado}
        onClienteCriado={onClienteCriado}
      />
    )
  }

  return (
    <PropostaFormPainel
      cliente={clienteSelecionado}
      marginsMap={marginsMap}
      onTrocarCliente={() => setClienteSelecionado(null)}
    />
  )
}
