import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Calendar, Download } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { FluxoContent } from './_components/FluxoContent'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Tesouraria · Outubro 2026"
        title="Fluxo de Caixa"
        subtitle="Saldo projetado para 90 dias · cenário base"
        actions={
          <>
            <Button variant="secondary" leftIcon={<Calendar className="h-4 w-4" />}>
              Mensal
            </Button>
            <Button leftIcon={<Download className="h-4 w-4" />}>Exportar</Button>
          </>
        }
      />
      <FluxoContent />
    </AppShell>
  )
}
