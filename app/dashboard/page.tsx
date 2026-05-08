import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { DashboardContent } from './_components/DashboardContent'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Mesa de operações · Tempo real"
        title="Dashboard"
        subtitle="Cotações ao vivo · CEPEA/ESALQ + Twelve Data"
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />}>Novo contrato</Button>
        }
      />
      <DashboardContent />
    </AppShell>
  )
}
