import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Filter, Plus } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { ClassificadosContent } from './_components/ClassificadosContent'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Marketplace · Comprar & Vender"
        title="Classificados"
        subtitle="248 ofertas ativas · 86 demandas abertas"
        actions={
          <>
            <Button variant="ghost" leftIcon={<Filter className="h-4 w-4" />}>
              Filtros
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />}>Anunciar lote</Button>
          </>
        }
      />
      <ClassificadosContent />
    </AppShell>
  )
}
