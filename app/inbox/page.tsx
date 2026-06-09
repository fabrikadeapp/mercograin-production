import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { InboxView } from './_components/InboxView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Inbox unificado' }

export default async function InboxPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')
  return (
    <AppShell>
      <PageHeader eyebrow="Mesa · Comunicação" title="Inbox unificado" subtitle="WhatsApp, e-mail e portal num só lugar. Converta mensagens em ofertas sem perder nada no scroll." />
      <InboxView />
    </AppShell>
  )
}
