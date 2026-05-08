import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Calendar, Plus } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { RelatoriosContent } from './_components/RelatoriosContent'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Análises · Safra 24/25"
        title="Relatórios"
        subtitle="Composição de margem e desempenho por canal"
        actions={
          <>
            <Button variant="secondary" leftIcon={<Calendar className="h-4 w-4" />}>
              Safra 24/25
            </Button>
            <Button variant="ghost">PDF</Button>
            <Button leftIcon={<Plus className="h-4 w-4" />}>Novo relatório</Button>
          </>
        }
      />
      <RelatoriosContent />
    </AppShell>
  )
}
