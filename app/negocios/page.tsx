import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { Handshake } from 'lucide-react'
import { NegociosView } from './_components/NegociosView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Negócios' }

export default async function NegociosPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')
  if (!(await isFeatureEnabled(scope.workspaceId, 'match'))) {
    return (
      <AppShell>
        <PageHeader eyebrow="Mesa" title="Negócios" subtitle="Deal flow." />
        <EmptyState icon={Handshake} title="Módulo não habilitado" description="O módulo de negócios/match não está ativo para esta corretora." />
      </AppShell>
    )
  }
  return (
    <AppShell>
      <PageHeader eyebrow="Mesa · Deal flow" title="Negócios" subtitle="Funil do negócio: oferta+demanda, as duas contrapartes e o avanço por estágio até a comissão recebida." />
      <NegociosView />
    </AppShell>
  )
}
