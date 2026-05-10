import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { SimuladorClient } from './SimuladorClient'

export const dynamic = 'force-dynamic'

export default async function SimuladorUFPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Fiscal · Simulador"
        title="Simulador tributário por UF"
        subtitle="Compara carga tributária (ICMS, PIS, COFINS, IRPJ, CSLL, FUNRURAL) ao operar em diferentes estados. Aproximação — confirme com contador."
      />
      <Card className="p-5">
        <SimuladorClient />
      </Card>
    </AppShell>
  )
}
