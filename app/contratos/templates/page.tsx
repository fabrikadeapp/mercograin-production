import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { TemplatesList } from './_TemplatesList'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Contratos · Templates"
        title="Templates de contrato"
        subtitle="Modelos reutilizáveis com variáveis dinâmicas"
        actions={
          <Link href="/contratos/templates/novo">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Novo template</Button>
          </Link>
        }
      />
      <TemplatesList />
    </AppShell>
  )
}
