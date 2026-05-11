import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'

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
      <PageHeader
        title="Centros de custo"
        subtitle={`${centros.length} centro(s)`}
        actions={
          <Link href="/financeiro/centros-custo/novo">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Novo centro</Button>
          </Link>
        }
      />
      <Card>
        <div className="p-4">
          {centros.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-fg-2 font-medium mb-1">Nenhum centro cadastrado</p>
              <p className="text-micro text-fg-3 mb-4">
                Centros de custo organizam suas despesas e receitas em uma árvore hierárquica.
              </p>
              <Link href="/financeiro/centros-custo/novo">
                <Button leftIcon={<Plus className="h-4 w-4" />}>
                  Criar primeiro centro
                </Button>
              </Link>
            </div>
          ) : (
            <ul>{render(null)}</ul>
          )}
        </div>
      </Card>
    </AppShell>
  )
}
