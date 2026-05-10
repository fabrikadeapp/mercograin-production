import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { BalancaWorkstation } from './_components/BalancaWorkstation'

export const dynamic = 'force-dynamic'

export default async function BalancaPage({
  searchParams,
}: {
  searchParams: { romaneioId?: string }
}) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const [romaneios, balancas] = await Promise.all([
    db.romaneio.findMany({
      where: { ...scope.whereOwn(), status: { in: ['rascunho', 'em_transito'] } },
      select: { id: true, numero: true, cultura: true, origem: true, destino: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.balanca.findMany({
      where: { ...scope.whereOwn(), ativa: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operação · Balança"
        title="Pesagem & classificação"
        subtitle="Pesagem rápida com classificação inline. Ideal pra plantão de balança."
      />
      <BalancaWorkstation
        romaneios={romaneios}
        balancas={balancas}
        defaultRomaneioId={searchParams.romaneioId}
      />
    </AppShell>
  )
}
