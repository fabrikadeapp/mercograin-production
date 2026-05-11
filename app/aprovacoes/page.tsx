import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import Link from 'next/link'
import { CheckSquare, FileText, Banknote } from 'lucide-react'
import { AppShell, PageHeader, Card, EmptyState } from '@/components/ui/phb'
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
        <Card className="p-10">
          <EmptyState
            icon={CheckSquare}
            title="Nenhuma aprovação pendente"
            description="Aprovações são criadas automaticamente quando um contrato, lançamento financeiro ou liberação ultrapassa o limite definido no workflow. Configure os limites em Configurações ou veja onde aprovações nascem:"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto mt-6">
            <Link href="/contratos" className="block">
              <Card className="p-4 hover:border-accent transition flex items-center gap-3">
                <FileText className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-fg-1 text-small font-medium">Contratos</p>
                  <p className="text-fg-3 text-micro">Acima do limite do operador</p>
                </div>
              </Card>
            </Link>
            <Link href="/financeiro" className="block">
              <Card className="p-4 hover:border-accent transition flex items-center gap-3">
                <Banknote className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-fg-1 text-small font-medium">Lançamentos financeiros</p>
                  <p className="text-fg-3 text-micro">Pagamentos acima do teto</p>
                </div>
              </Card>
            </Link>
          </div>
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
