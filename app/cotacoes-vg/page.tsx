import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Filter, Plus } from 'lucide-react'
import { VgAppShell, VgPageHeader } from '@/components/ui/visionglass'
import { CotacoesContent } from '../cotacoes/_components/CotacoesContent'
import { HistoricoAvancado } from '@/components/cotacoes/HistoricoAvancado'
import { MesaShortcutsClient } from '@/components/cotacoes/MesaShortcutsClient'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <VgAppShell>
      <VgPageHeader
        eyebrow="Mesa · CEPEA + B3 + USDA"
        title="Cotações"
        subtitle="Watchlist customizada · streaming ativo"
        actions={
          <>
            <button className="vg-btn vg-btn--secondary">
              <Filter className="w-4 h-4" /> Filtros
            </button>
            <button className="vg-btn vg-btn--primary">
              <Plus className="w-4 h-4" /> Novo alerta
            </button>
          </>
        }
      />
      <CotacoesContent />
      <div className="mt-6">
        <HistoricoAvancado />
      </div>
      <MesaShortcutsClient />
    </VgAppShell>
  )
}
