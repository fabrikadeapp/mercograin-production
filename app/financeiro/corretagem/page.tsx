import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { AppShell } from '@/components/ui/phb'
import { CorretagemView } from './_components/CorretagemView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Corretagem' }

export default async function CorretagemPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')
  const canEdit =
    scope.isAdmin || scope.workspaceRole === 'owner' || scope.workspaceRole === 'admin'
  return (
    <AppShell>
      <CorretagemView canEdit={canEdit} />
    </AppShell>
  )
}
