import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'

export const dynamic = 'force-dynamic'

export default async function WorkflowsAdminPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')
  if (
    !scope.isAdmin &&
    !scope.isWorkspaceOwner &&
    scope.workspaceRole !== 'admin'
  ) {
    redirect('/dashboard')
  }

  const workflows = await db.aprovacaoWorkflow.findMany({
    where: scope.whereOwn(),
    orderBy: { createdAt: 'desc' },
  })

  return (
    <AppShell>
      <PageHeader
        title="Workflows de aprovação"
        subtitle={`${workflows.length} workflow(s) configurado(s)`}
      />
      <Card>
        <div className="p-4">
          {workflows.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nenhum workflow configurado. Crie via API POST /api/aprovacao-workflows
              ou use a UI de criação (em breve).
            </p>
          ) : (
            <ul className="divide-y">
              {workflows.map((w) => {
                const etapas = Array.isArray(w.etapas) ? (w.etapas as any[]) : []
                const cond = (w.condicao as any) || {}
                return (
                  <li key={w.id} className="py-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="font-semibold text-sm">{w.nome}</h3>
                      <div className="flex gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-zinc-100">
                          {w.entidade}
                        </span>
                        <span
                          className={
                            'px-2 py-0.5 rounded ' +
                            (w.ativo
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-zinc-200 text-zinc-500')
                          }
                        >
                          {w.ativo ? 'ativo' : 'inativo'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-100">
                          SLA {w.slaHoras}h
                        </span>
                      </div>
                    </div>
                    {w.descricao && (
                      <p className="text-xs text-zinc-500">{w.descricao}</p>
                    )}
                    <p className="text-xs text-zinc-600">
                      Disparo:{' '}
                      {cond.sempre
                        ? 'sempre'
                        : cond.valorMinimo
                          ? `valor ≥ R$ ${cond.valorMinimo.toLocaleString('pt-BR')}`
                          : cond.qtdMinimaSc
                            ? `qtd ≥ ${cond.qtdMinimaSc} sc`
                            : '—'}
                    </p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {etapas.map((e: any, i: number) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700"
                        >
                          {e.ordem}. {e.nome} ({e.role})
                        </span>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>
    </AppShell>
  )
}
