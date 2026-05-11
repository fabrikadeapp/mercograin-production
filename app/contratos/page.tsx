import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Filter, Plus, FileText } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { ContratosContent } from './_components/ContratosContent'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Pipeline · Safra 24/25"
        title="Contratos"
        subtitle="312 ativos · R$ 18,4M em negociação"
        actions={
          <>
            <Link href="/contratos/templates">
              <Button variant="ghost" leftIcon={<FileText className="h-4 w-4" />}>
                Templates
              </Button>
            </Link>
            <Button variant="secondary" leftIcon={<Filter className="h-4 w-4" />}>
              Filtros (3)
            </Button>
            <Link href="/contratos/novo">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Novo contrato</Button>
            </Link>
          </>
        }
      />
      <ContratosContent />
    </AppShell>
  )
}
