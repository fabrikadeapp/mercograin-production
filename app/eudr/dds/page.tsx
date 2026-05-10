import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

const riscoLabel: Record<string, { txt: string; cls: string }> = {
  baixo: { txt: 'baixo', cls: 'bg-emerald-500/15 text-emerald-300' },
  medio: { txt: 'médio', cls: 'bg-yellow-500/15 text-yellow-300' },
  alto: { txt: 'alto', cls: 'bg-orange-500/15 text-orange-300' },
  critico: { txt: 'crítico', cls: 'bg-red-500/15 text-red-300' },
}

const conclusaoLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  em_revisao: 'Em revisão',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  enviada_ue: 'Enviada UE',
}

export default async function DDSListPage({
  searchParams,
}: {
  searchParams: { conclusao?: string }
}) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const where: any = { ...scope.whereOwn() }
  if (searchParams?.conclusao) where.conclusao = searchParams.conclusao

  const items = await db.dueDiligenceStatement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { contrato: { select: { numero: true } } },
  })

  return (
    <AppShell>
      <PageHeader
        eyebrow="Compliance · EUDR"
        title="Due Diligence Statements"
        subtitle="Statements emitidos pelo workspace."
        actions={
          <Link href="/eudr/dds/nova">
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Nova DDS
            </Button>
          </Link>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-zinc-400 text-left">
              <tr>
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">Contrato</th>
                <th className="px-3 py-2">Cultura</th>
                <th className="px-3 py-2">Qtd (t)</th>
                <th className="px-3 py-2">Risco</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Criada</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                    Nenhuma DDS ainda. Comece criando uma nova.
                  </td>
                </tr>
              ) : (
                items.map((dds) => {
                  const r = riscoLabel[dds.riscoNivel] || riscoLabel.baixo
                  return (
                    <tr key={dds.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-3 py-2">
                        <Link href={`/eudr/dds/${dds.id}`} className="text-emerald-400 hover:underline">
                          {dds.numero}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{dds.contrato?.numero || '—'}</td>
                      <td className="px-3 py-2">{dds.cultura}</td>
                      <td className="px-3 py-2">{dds.qtdToneladas.toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${r.cls}`}>{r.txt}</span>
                      </td>
                      <td className="px-3 py-2">{conclusaoLabel[dds.conclusao] || dds.conclusao}</td>
                      <td className="px-3 py-2 text-zinc-400">
                        {new Date(dds.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  )
}
