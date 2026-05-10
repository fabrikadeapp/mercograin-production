import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { AprovacaoCard } from './_components/AprovacaoCard'

export const dynamic = 'force-dynamic'

export default async function AprovacoesPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const aprovacoes = await db.aprovacao.findMany({
    where: { ...scope.whereOwn(), status: 'pendente' },
    include: {
      workflow: { select: { nome: true, etapas: true, entidade: true } },
      solicitante: { select: { nome: true, email: true } },
      decisoes: {
        include: { aprovador: { select: { nome: true } } },
        orderBy: { etapa: 'asc' },
      },
    },
    orderBy: { prazoEtapaAtual: 'asc' },
  })

  return (
    <AppShell>
      <PageHeader
        title="Aprovações pendentes"
        subtitle={`${aprovacoes.length} pendente(s)`}
      />
      {aprovacoes.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500 p-6 text-center">
            Nenhuma aprovação pendente.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {aprovacoes.map((a) => (
            <AprovacaoCard
              key={a.id}
              aprovacao={JSON.parse(JSON.stringify(a))}
            />
          ))}
        </div>
      )}
    </AppShell>
  )
}
