import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Filter, Plus } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { CotacoesContent } from './_components/CotacoesContent'
import { HistoricoAvancado } from '@/components/cotacoes/HistoricoAvancado'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa · CEPEA + B3 + USDA"
        title="Cotações"
        subtitle="Watchlist customizada · streaming ativo"
        actions={
          <>
            <Button variant="secondary" leftIcon={<Filter className="h-4 w-4" />}>
              Filtros
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />}>Novo alerta</Button>
          </>
        }
      />
      <CotacoesContent />
      <div className="mt-6">
        <HistoricoAvancado />
      </div>
    </AppShell>
  )
}
