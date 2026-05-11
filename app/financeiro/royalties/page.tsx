import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'

export const dynamic = 'force-dynamic'

export default async function RoyaltiesPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const royalties = await db.royalty.findMany({
    where: scope.whereOwn(),
    include: {
      contrato: { select: { numero: true } },
      detentor: { select: { razaoSocial: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const totais = royalties.reduce(
    (acc, r) => {
      const v = Number(r.valorTotal)
      acc[r.status] = (acc[r.status] || 0) + v
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <AppShell>
      <PageHeader
        title="Royalties"
        subtitle={`Apurado: R$ ${(totais.apurado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Pago: R$ ${(totais.pago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
        actions={
          <Link href="/financeiro/royalties/novo">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Novo royalty</Button>
          </Link>
        }
      />
      <Card>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b">
                <th className="py-2">Contrato</th>
                <th>Detentor</th>
                <th>Cultivar</th>
                <th className="text-right">Qtd (sc)</th>
                <th className="text-right">R$/sc</th>
                <th className="text-right">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {royalties.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{r.contrato.numero}</td>
                  <td>{r.detentor.razaoSocial}</td>
                  <td>{r.cultivar}</td>
                  <td className="text-right font-mono">{r.qtdSc}</td>
                  <td className="text-right font-mono">
                    {Number(r.valorPorSc).toFixed(4)}
                  </td>
                  <td className="text-right font-mono">
                    R${' '}
                    {Number(r.valorTotal).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td>
                    <span
                      className={
                        'px-2 py-0.5 text-xs rounded ' +
                        (r.status === 'pago'
                          ? 'bg-emerald-100 text-emerald-700'
                          : r.status === 'contestado'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-zinc-100')
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {royalties.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-zinc-500">
                    Nenhum royalty apurado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  )
}
