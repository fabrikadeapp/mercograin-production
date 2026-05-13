'use client'

import { useState } from 'react'
import { BhGrainTopBar } from './BhGrainTopBar'
import { PrioridadesDrawer } from './PrioridadesDrawer'
import { PropostaDetailDrawer } from './PropostaDetailDrawer'
import { DemoBanner } from './DemoBanner'

interface Props {
  children: React.ReactNode
  userName: string | null
  workspaceName: string | null
}

/**
 * Shell BH Grain — topbar dedicada (BH azul + menu mínimo + ⌘K + Prioridades IA).
 * Bg agrícola dark herda de /visionglass/bg-hero.jpg (mesmo asset).
 */
export function BhGrainShell({ children, userName, workspaceName }: Props) {
  const [prioridadesOpen, setPrioridadesOpen] = useState(false)
  const [propostaId, setPropostaId] = useState<string | null>(null)

  return (
    <div
      className="min-h-screen w-full relative"
      style={{
        // Pôr-do-sol agrícola: laranja quente no topo → escuro embaixo + foto de fundo
        backgroundImage:
          "linear-gradient(180deg, rgba(245,158,11,0.10) 0%, rgba(20,15,10,0.85) 35%, rgba(10,10,12,0.95) 100%), url('/visionglass/bg-hero.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
        color: 'var(--vg-fg-primary)',
      }}
    >
      <DemoBanner />
      <BhGrainTopBar
        userName={userName}
        workspaceName={workspaceName}
        onOpenPrioridades={() => setPrioridadesOpen(true)}
      />

      <main className="pt-24 pb-12 md:pb-8 px-3 md:px-6 relative z-0">
        <div className="mx-auto w-full" style={{ maxWidth: '1400px' }}>
          {children}
        </div>
      </main>

      <PrioridadesDrawer
        open={prioridadesOpen}
        onClose={() => setPrioridadesOpen(false)}
        onOpenProposta={(id) => {
          setPrioridadesOpen(false)
          setPropostaId(id)
        }}
      />
      <PropostaDetailDrawer propostaId={propostaId} onClose={() => setPropostaId(null)} />
    </div>
  )
}
