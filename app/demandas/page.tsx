import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { isFeatureEnabled } from '@/lib/features'
import { AppShell, PageHeader, EmptyState } from '@/components/ui/phb'
import { ShoppingCart } from 'lucide-react'
import { DemandasView } from './_components/DemandasView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Demandas de compra' }

export default async function DemandasPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')
  if (!(await isFeatureEnabled(scope.workspaceId, 'demandas'))) {
    return (
      <AppShell>
        <PageHeader eyebrow="Mesa" title="Demandas de compra" subtitle="Pedidos de quem quer comprar." />
        <EmptyState icon={ShoppingCart} title="Módulo não habilitado" description="As demandas de compra não estão ativas para esta corretora." />
      </AppShell>
    )
  }
  return (
    <AppShell>
      <PageHeader eyebrow="Mesa · Compra" title="Demandas de compra" subtitle="Pedidos de compra estruturados — recebidos por WhatsApp, e-mail, Instagram ou registrados manualmente." />
      <DemandasView />
    </AppShell>
  )
}
