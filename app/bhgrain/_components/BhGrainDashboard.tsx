'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { ClientesCard } from './ClientesCard'
import { InboxCard } from './InboxCard'
import { PrecosCard } from './PrecosCard'
import { PropostasCard } from './PropostasCard'
import { PipelineCard } from './PipelineCard'
import { IndicadoresCard } from './IndicadoresCard'
import { FaturamentoMetaCard } from './FaturamentoMetaCard'
import { HealthCard } from './HealthCard'
import { PropostaDetailDrawer } from './PropostaDetailDrawer'
import { ConversaDrawer } from './ConversaDrawer'

interface Props {
  firstName: string
  workspaceName: string
}

export function BhGrainDashboard({ firstName, workspaceName }: Props) {
  const [propostaId, setPropostaId] = useState<string | null>(null)
  const [conversaId, setConversaId] = useState<string | null>(null)
  const [alertasCount, setAlertasCount] = useState<number>(0)

  useEffect(() => {
    fetch('/api/dashboard/resumo')
      .then((r) => r.json())
      .then((j) => {
        if (j.enabled && j.resumo) setAlertasCount(j.resumo.alertasAbertos ?? 0)
      })
      .catch(() => {})
  }, [])

  const openProposta = useCallback((id: string) => setPropostaId(id), [])

  return (
    <div className="space-y-4">
      {/* Cabeçalho compacto da página (topbar global vem do BhGrainShell) */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] text-vg-fg-3 uppercase tracking-wider">Mesa operacional</div>
          <h1 className="text-[20px] font-semibold tracking-tight">Bom dia, {firstName}</h1>
          <div className="text-[12px] text-vg-fg-3">{workspaceName}</div>
        </div>
        {alertasCount > 0 && (
          <Link
            href="/admin/bhgrain/alertas"
            className="text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
            style={{
              background: 'rgba(239,68,68,0.15)',
              color: 'var(--vg-destructive, #ef4444)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            <Bell className="w-3 h-3" /> {alertasCount} alertas
          </Link>
        )}
      </header>

      {/*
        Linha 1: 4 cards operacionais
        Mobile (single col): Inbox 1º, Propostas 2º, Clientes 3º, Preços 4º (§35).
        Desktop: ordem natural Clientes/Inbox/Preços/Propostas.
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="order-3 md:order-1"><ClientesCard /></div>
        <div className="order-1 md:order-2"><InboxCard onOpenConversa={setConversaId} /></div>
        <div className="order-4 md:order-3"><PrecosCard /></div>
        <div className="order-2 md:order-4"><PropostasCard onOpenProposta={openProposta} /></div>
      </div>

      {/* Linha 2: pipeline (2 col xl) + indicadores + faturamento */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-2 order-1">
          <PipelineCard onOpenProposta={openProposta} />
        </div>
        <div className="order-3 md:order-2"><IndicadoresCard /></div>
        <div className="order-2 md:order-3"><FaturamentoMetaCard /></div>
      </div>

      {/* Linha 3: health compacto (full-width) */}
      <div className="grid grid-cols-1 gap-4">
        <HealthCard />
      </div>

      <PropostaDetailDrawer propostaId={propostaId} onClose={() => setPropostaId(null)} />
      <ConversaDrawer conversationId={conversaId} onClose={() => setConversaId(null)} />
    </div>
  )
}
