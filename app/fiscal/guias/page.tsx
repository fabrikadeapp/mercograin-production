import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { GuiasClient } from './GuiasClient'

export const dynamic = 'force-dynamic'

export default async function GuiasPage({ searchParams }: { searchParams: { tipo?: string; status?: string } }) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const where: any = scope.whereOwn()
  if (searchParams.tipo) where.tipo = searchParams.tipo
  if (searchParams.status) where.status = searchParams.status

  const guias = await db.guia.findMany({
    where,
    orderBy: [{ vencimento: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  })

  // Sanitize Decimals (server → client)
  const data = guias.map((g) => ({
    ...g,
    valorPrincipal: Number(g.valorPrincipal),
    multa: Number(g.multa),
    juros: Number(g.juros),
    valorTotal: Number(g.valorTotal),
    vencimento: g.vencimento.toISOString(),
    pagoEm: g.pagoEm?.toISOString() ?? null,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }))

  return (
    <AppShell>
      <PageHeader
        eyebrow="Fiscal · Guias"
        title="Guias de Arrecadação"
        subtitle="DARF (federal) · GNRE (ICMS interestadual) · GARE-ICMS (SP). Linha digitável e código de barras gerados localmente."
      />
      <Card className="p-5">
        <GuiasClient
          guias={data as any}
          filtroTipo={searchParams.tipo ?? ''}
          filtroStatus={searchParams.status ?? ''}
        />
      </Card>
    </AppShell>
  )
}
