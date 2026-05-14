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
 * Shell BH Grain — design v2 NewDB.
 * Fundo sólido NewDB com radial gradients suaves (sem foto agrícola — clareza primeiro).
 */
export function BhGrainShell({ children, userName, workspaceName }: Props) {
  const [prioridadesOpen, setPrioridadesOpen] = useState(false)
  const [propostaId, setPropostaId] = useState<string | null>(null)

  return (
    <div
      className="min-h-screen w-full relative"
      style={{
        background:
          'radial-gradient(1200px 700px at 10% -10%, var(--accent-soft), transparent 60%), ' +
          'radial-gradient(900px 500px at 100% 0%, var(--accent-2-soft), transparent 60%), ' +
          'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <DemoBanner />
      <BhGrainTopBar
        userName={userName}
        workspaceName={workspaceName}
        onOpenPrioridades={() => setPrioridadesOpen(true)}
      />

      <main className="pt-4 pb-12 md:pb-8 px-3 md:px-6 relative z-0">
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
