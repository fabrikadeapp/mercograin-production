import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, BarChart } from '@/components/ui/phb'
import { resumirLongShort } from '@/lib/hedge/exposicao'

export const dynamic = 'force-dynamic'

function fmtUSD(n: number): string {
  return `US$ ${Math.round(n).toLocaleString('pt-BR')}`
}

export default async function LongShortPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const posicoes = await db.posicaoHedge.findMany({
    where: { ...scope.whereOwn(), status: 'aberta' },
  })

  const resumo = resumirLongShort(
    posicoes.map((p) => ({
      cultura: p.cultura ?? 'cambial',
      tipo: p.tipo as 'long' | 'short',
      qtdContratos: Number(p.qtdContratos),
      notionalUSD:
        Number(p.qtdContratos) * 5000 * Number(p.precoEntradaUsdBu ?? 0),
    }))
  )

  const chartData = resumo.flatMap((r) => [
    { label: `${r.cultura} L`, value: r.qtdLong },
    { label: `${r.cultura} S`, value: r.qtdShort },
  ])

  return (
    <AppShell>
      <PageHeader
        eyebrow="Hedge"
        title="Long × Short"
        subtitle="Visão consolidada por cultura — net direcional e exposição em USD."
      />

      <Card className="p-5 mb-4">
        <p className="eyebrow mb-3">Contratos por cultura (Long vs Short)</p>
        {chartData.length > 0 ? (
          <BarChart data={chartData} height={260} />
        ) : (
          <p className="text-fg-3 text-small">Sem posições abertas.</p>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-small">
          <thead className="bg-bg-2 text-fg-3">
            <tr>
              <th className="text-left p-3">Cultura</th>
              <th className="text-right p-3">Qtd Long</th>
              <th className="text-right p-3">Qtd Short</th>
              <th className="text-right p-3">Net</th>
              <th className="text-right p-3">Notional Long (USD)</th>
              <th className="text-right p-3">Notional Short (USD)</th>
              <th className="text-right p-3">Net Notional (USD)</th>
            </tr>
          </thead>
          <tbody>
            {resumo.map((r) => (
              <tr key={r.cultura} className="border-t border-border-1">
                <td className="p-3 font-medium">{r.cultura}</td>
                <td className="p-3 text-right t-num-sm text-pos">{r.qtdLong}</td>
                <td className="p-3 text-right t-num-sm text-neg">{r.qtdShort}</td>
                <td
                  className={`p-3 text-right t-num-sm ${r.net >= 0 ? 'text-pos' : 'text-neg'}`}
                >
                  {r.net}
                </td>
                <td className="p-3 text-right t-num-sm">
                  {fmtUSD(r.notionalLongUSD)}
                </td>
                <td className="p-3 text-right t-num-sm">
                  {fmtUSD(r.notionalShortUSD)}
                </td>
                <td
                  className={`p-3 text-right t-num-sm ${r.netNotionalUSD >= 0 ? 'text-pos' : 'text-neg'}`}
                >
                  {fmtUSD(r.netNotionalUSD)}
                </td>
              </tr>
            ))}
            {resumo.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-fg-3">
                  Sem posições abertas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </AppShell>
  )
}
