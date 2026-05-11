import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { CorretorContent } from './CorretorContent'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="BI · Corretor"
        title="Desempenho do corretor"
        subtitle="Contratos, hit rate, comissão, tempo de fechamento e ranking"
      />
      <CorretorContent corretorId={params.id} />
    </AppShell>
  )
}
