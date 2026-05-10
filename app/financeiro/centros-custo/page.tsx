import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'

export const dynamic = 'force-dynamic'

export default async function CentrosCustoPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const centros = await db.centroCusto.findMany({
    where: scope.whereOwn(),
    orderBy: { codigo: 'asc' },
  })

  // Build tree
  const byParent = new Map<string | null, typeof centros>()
  for (const c of centros) {
    const arr = byParent.get(c.paiId) || []
    arr.push(c)
    byParent.set(c.paiId, arr)
  }
  function render(parentId: string | null, depth = 0): JSX.Element[] {
    const items = byParent.get(parentId) || []
    return items.flatMap((c) => [
      <li key={c.id} style={{ paddingLeft: depth * 16 }} className="py-1.5 text-sm border-b last:border-0 flex items-center justify-between">
        <span>
          <span className="font-mono text-xs text-zinc-500 mr-2">{c.codigo}</span>
          <span>{c.nome}</span>
        </span>
        {!c.ativo && <span className="text-xs text-zinc-400">inativo</span>}
      </li>,
      ...render(c.id, depth + 1),
    ])
  }

  return (
    <AppShell>
      <PageHeader title="Centros de custo" subtitle={`${centros.length} centro(s)`} />
      <Card>
        <div className="p-4">
          {centros.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum centro cadastrado.</p>
          ) : (
            <ul>{render(null)}</ul>
          )}
        </div>
      </Card>
    </AppShell>
  )
}
