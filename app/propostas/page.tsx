import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutGrid, Plus } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { PropostasContent } from './_components/PropostasContent'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  return (
    <AppShell>
      <PageHeader
        eyebrow="Pipeline · Comercial"
        title="Propostas"
        subtitle="Propostas que ainda não viraram negócio"
        actions={
          <>
            <Link href="/propostas/kanban">
              <Button variant="ghost" leftIcon={<LayoutGrid className="h-4 w-4" />}>
                Kanban
              </Button>
            </Link>
            <Link href="/propostas/nova">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Nova proposta</Button>
            </Link>
          </>
        }
      />
      <PropostasContent />
    </AppShell>
  )
}
