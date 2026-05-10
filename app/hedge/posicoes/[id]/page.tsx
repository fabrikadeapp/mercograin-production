import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, Chip, AreaChart } from '@/components/ui/phb'
import { PosicaoActions } from '../../_components/PosicaoActions'

export const dynamic = 'force-dynamic'

function fmt(n: number | null | undefined, prefix = '', dec = 2): string {
  if (n === null || n === undefined) return '—'
  return `${prefix}${Number(n).toLocaleString('pt-BR', {
    maximumFractionDigits: dec,
  })}`
}

export default async function PosicaoDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const pos = await db.posicaoHedge.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: {
      contratoOrigem: { select: { id: true, numero: true } },
      marcacoes: { orderBy: { data: 'asc' }, take: 90 },
    },
  })
  if (!pos) notFound()

  const ult = pos.marcacoes[pos.marcacoes.length - 1]
  const pnlAtualUSD = pos.status === 'fechada' ? Number(pos.pnlFinalUSD ?? 0) : Number(ult?.pnlUnrealizedUSD ?? 0)
  const pnlAtualBRL = pos.status === 'fechada' ? Number(pos.pnlFinalBRL ?? 0) : Number(ult?.pnlUnrealizedBRL ?? 0)

  const chartData = pos.marcacoes.map((m) => ({
    label: m.data.toISOString().slice(5, 10),
    value: Number(m.pnlUnrealizedBRL),
  }))

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Hedge · ${pos.numero}`}
        title={`Posição ${pos.tipo.toUpperCase()} ${pos.cultura ?? ''}`}
        subtitle={`Contrato ${pos.contratoFuturo} · Vencimento ${pos.vencimento.toISOString().slice(0, 10)}`}
      />

      <div className="flex items-center gap-3 mb-4">
        <Chip variant={pos.tipo === 'long' ? 'pos' : 'neg'}>
          {pos.tipo.toUpperCase()}
        </Chip>
        <Chip variant={pos.status === 'aberta' ? 'pos' : 'neutral'}>
          {pos.status}
        </Chip>
        {pos.contratoOrigem ? (
          <Chip variant="info">
            Hedge de {pos.contratoOrigem.numero}
          </Chip>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="p-5">
          <p className="eyebrow mb-2">Preço entrada</p>
          <p className="t-num-lg">{fmt(Number(pos.precoEntradaUsdBu), 'US$ ', 4)}/bu</p>
          <p className="text-fg-3 text-small">
            Câmbio: {fmt(Number(pos.cambioEntradaUsdBrl), '', 4)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="eyebrow mb-2">Preço atual</p>
          <p className="t-num-lg">
            {fmt(ult ? Number(ult.precoMercadoUsdBu) : null, 'US$ ', 4)}/bu
          </p>
          <p className="text-fg-3 text-small">
            Câmbio: {fmt(ult ? Number(ult.cambioUsdBrl) : null, '', 4)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="eyebrow mb-2">P&L (unrealized)</p>
          <p
            className={`t-num-lg ${pnlAtualBRL >= 0 ? 'text-pos' : 'text-neg'}`}
          >
            {fmt(pnlAtualBRL, 'R$ ')}
          </p>
          <p className="text-fg-3 text-small">
            {fmt(pnlAtualUSD, 'US$ ')} · {pos.qtdContratos} contrato(s) ·{' '}
            {pos.qtdEquivalenteSc.toFixed(0)} sc-eq
          </p>
        </Card>
      </div>

      <PosicaoActions posicaoId={pos.id} status={pos.status} />

      <Card className="p-5 mb-4">
        <p className="eyebrow mb-2">Marcações últimas {pos.marcacoes.length} dias</p>
        {chartData.length > 1 ? (
          <AreaChart data={chartData} height={220} />
        ) : (
          <p className="text-fg-3 text-small">
            Sem histórico ainda. Clique em "Marcar agora" pra registrar.
          </p>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-small">
          <thead className="bg-bg-2 text-fg-3">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-right p-3">Preço (USD/bu)</th>
              <th className="text-right p-3">Câmbio</th>
              <th className="text-right p-3">P&L USD</th>
              <th className="text-right p-3">P&L BRL</th>
              <th className="text-right p-3">Δ dia BRL</th>
            </tr>
          </thead>
          <tbody>
            {[...pos.marcacoes].reverse().map((m) => (
              <tr key={m.id} className="border-t border-border-1">
                <td className="p-3">{m.data.toISOString().slice(0, 10)}</td>
                <td className="p-3 text-right t-num-sm">
                  {fmt(Number(m.precoMercadoUsdBu), '', 4)}
                </td>
                <td className="p-3 text-right t-num-sm">
                  {fmt(Number(m.cambioUsdBrl), '', 4)}
                </td>
                <td
                  className={`p-3 text-right t-num-sm ${Number(m.pnlUnrealizedUSD) >= 0 ? 'text-pos' : 'text-neg'}`}
                >
                  {fmt(Number(m.pnlUnrealizedUSD), 'US$ ')}
                </td>
                <td
                  className={`p-3 text-right t-num-sm ${Number(m.pnlUnrealizedBRL) >= 0 ? 'text-pos' : 'text-neg'}`}
                >
                  {fmt(Number(m.pnlUnrealizedBRL), 'R$ ')}
                </td>
                <td className="p-3 text-right t-num-sm">
                  {fmt(m.variacaoDiaBRL ? Number(m.variacaoDiaBRL) : null, 'R$ ')}
                </td>
              </tr>
            ))}
            {pos.marcacoes.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-fg-3">
                  Sem marcações.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </AppShell>
  )
}
