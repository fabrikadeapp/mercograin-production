import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { LogisticaContent } from './_components/LogisticaContent'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operações · Movimentação"
        title="Logística"
        subtitle="Cargas, armazéns e motoristas — pipeline completo da operação."
        actions={
          <Link href="/logistica/ordens/novo">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Nova ordem</Button>
          </Link>
        }
      />
      <LogisticaContent />
    </AppShell>
  )
}
