import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, Chip, Button } from '@/components/ui/phb'
import { NovoNdfDialog } from '../_components/NovoNdfDialog'

export const dynamic = 'force-dynamic'

export default async function NdfPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const ndfs = await db.nDF.findMany({
    where: scope.whereOwn(),
    orderBy: { dataVencimento: 'asc' },
  })

  return (
    <AppShell>
      <PageHeader
        eyebrow="Hedge"
        title="NDF — Forwards"
        subtitle="Non-Deliverable Forwards de moeda e commodity com bancos parceiros."
        actions={<NovoNdfDialog />}
      />

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-small">
          <thead className="bg-bg-2 text-fg-3">
            <tr>
              <th className="text-left p-3">Número</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Contraparte</th>
              <th className="text-left p-3">Direção</th>
              <th className="text-left p-3">Ativo</th>
              <th className="text-right p-3">Notional</th>
              <th className="text-right p-3">Strike</th>
              <th className="text-right p-3">Vencimento</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {ndfs.map((n) => (
              <tr key={n.id} className="border-t border-border-1">
                <td className="p-3">{n.numero}</td>
                <td className="p-3">
                  <Chip variant={n.tipo === 'moeda' ? 'info' : 'accent'}>{n.tipo}</Chip>
                </td>
                <td className="p-3">{n.contraparteNome}</td>
                <td className="p-3 text-fg-2">{n.direcao}</td>
                <td className="p-3 t-num-sm">{n.ativoTipo}</td>
                <td className="p-3 text-right t-num-sm">
                  {Number(n.notional).toLocaleString('pt-BR', {
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="p-3 text-right t-num-sm">
                  {Number(n.strike).toFixed(4)}
                </td>
                <td className="p-3 text-right t-num-sm">
                  {n.dataVencimento.toISOString().slice(0, 10)}
                </td>
                <td className="p-3">
                  <Chip
                    variant={
                      n.status === 'aberta'
                        ? 'pos'
                        : n.status === 'liquidada'
                          ? 'neutral'
                          : 'warn'
                    }
                  >
                    {n.status}
                  </Chip>
                </td>
                <td
                  className={`p-3 text-right t-num-sm ${Number(n.resultadoBRL ?? 0) >= 0 ? 'text-pos' : 'text-neg'}`}
                >
                  {n.resultadoBRL
                    ? `R$ ${Number(n.resultadoBRL).toLocaleString('pt-BR', {
                        maximumFractionDigits: 2,
                      })}`
                    : '—'}
                </td>
              </tr>
            ))}
            {ndfs.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-fg-3">
                  Sem NDFs registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </AppShell>
  )
}
