import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { COMMODITIES, CATEGORY_LABELS, DEFAULT_DASHBOARD_IDS } from '@/lib/commodities/catalog'
import { CotacoesDashboardForm } from './_components/CotacoesDashboardForm'

export const dynamic = 'force-dynamic'

export default async function CotacoesConfigPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const ws = await db.workspace.findUnique({
    where: { id: scope.workspaceId },
    select: { dashboardSymbols: true },
  })
  const stored = Array.isArray(ws?.dashboardSymbols)
    ? (ws.dashboardSymbols as unknown as string[])
    : null
  const selectedIds = stored ?? DEFAULT_DASHBOARD_IDS

  const canEdit =
    scope.isAdmin || scope.workspaceRole === 'owner' || scope.workspaceRole === 'admin'

  // Agrupa por categoria para apresentação
  const grouped: { category: string; label: string; items: { id: string; name: string }[] }[] = []
  const byCat = new Map<string, { id: string; name: string }[]>()
  for (const c of COMMODITIES) {
    if (!byCat.has(c.category)) byCat.set(c.category, [])
    byCat.get(c.category)!.push({ id: c.id, name: c.name })
  }
  for (const [cat, items] of byCat) {
    grouped.push({
      category: cat,
      label: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat,
      items,
    })
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Configurações"
        title="Commodities no dashboard"
        subtitle="Escolha quais futures aparecem no widget 'Real Time Commodity Futures Prices' do dashboard. Padrão: foco em grãos + metais + energia."
        search={false}
      />
      <CotacoesDashboardForm
        canEdit={canEdit}
        initialSelected={selectedIds}
        isCustom={stored !== null}
        defaultIds={DEFAULT_DASHBOARD_IDS}
        grouped={grouped}
      />
    </AppShell>
  )
}
