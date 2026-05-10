import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, Chip, Button } from '@/components/ui/phb'

export const dynamic = 'force-dynamic'

interface SearchParams {
  status?: string
  cultura?: string
  tipo?: string
}

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n === null || n === undefined) return '—'
  return `${prefix}${Number(n).toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
  })}`
}

export default async function PosicoesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const where: any = scope.whereOwn()
  if (searchParams.status) where.status = searchParams.status
  if (searchParams.cultura) where.cultura = searchParams.cultura
  if (searchParams.tipo) where.tipo = searchParams.tipo

  const posicoes = await db.posicaoHedge.findMany({
    where,
    include: {
      contratoOrigem: { select: { numero: true } },
      marcacoes: {
        orderBy: { data: 'desc' },
        take: 1,
      },
    },
    orderBy: { abertoEm: 'desc' },
    take: 100,
  })

  return (
    <AppShell>
      <PageHeader
        eyebrow="Hedge"
        title="Posições"
        subtitle="Long/Short com marcação a mercado e P&L em tempo real."
        actions={
          <Link href="/hedge/posicoes/nova">
            <Button variant="primary">Nova posição</Button>
          </Link>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link href="/hedge/posicoes" className="inline-flex">
          <Chip variant={!searchParams.status ? 'pos' : 'neutral'}>Todas</Chip>
        </Link>
        <Link href="/hedge/posicoes?status=aberta" className="inline-flex">
          <Chip variant={searchParams.status === 'aberta' ? 'pos' : 'neutral'}>
            Abertas
          </Chip>
        </Link>
        <Link href="/hedge/posicoes?status=fechada" className="inline-flex">
          <Chip variant={searchParams.status === 'fechada' ? 'pos' : 'neutral'}>
            Fechadas
          </Chip>
        </Link>
        <Link href="/hedge/posicoes?tipo=long" className="inline-flex">
          <Chip variant={searchParams.tipo === 'long' ? 'pos' : 'neutral'}>Long</Chip>
        </Link>
        <Link href="/hedge/posicoes?tipo=short" className="inline-flex">
          <Chip variant={searchParams.tipo === 'short' ? 'neg' : 'neutral'}>Short</Chip>
        </Link>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-small">
          <thead className="bg-bg-2 text-fg-3">
            <tr>
              <th className="text-left p-3">Número</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Cultura</th>
              <th className="text-right p-3">Qtd</th>
              <th className="text-right p-3">Entrada</th>
              <th className="text-right p-3">Atual</th>
              <th className="text-right p-3">P&L (BRL)</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {posicoes.map((p) => {
              const ult = p.marcacoes[0]
              const pnl = p.status === 'fechada' ? Number(p.pnlFinalBRL ?? 0) : Number(ult?.pnlUnrealizedBRL ?? 0)
              return (
                <tr
                  key={p.id}
                  className="border-t border-border-1 hover:bg-bg-2 cursor-pointer"
                >
                  <td className="p-3">
                    <Link href={`/hedge/posicoes/${p.id}`} className="text-accent">
                      {p.numero}
                    </Link>
                  </td>
                  <td className="p-3">
                    <Chip variant={p.tipo === 'long' ? 'pos' : 'neg'}>
                      {p.tipo.toUpperCase()}
                    </Chip>
                  </td>
                  <td className="p-3 text-fg-2">{p.cultura ?? 'cambial'}</td>
                  <td className="p-3 text-right t-num-sm">{p.qtdContratos}</td>
                  <td className="p-3 text-right t-num-sm">
                    {fmt(p.precoEntradaUsdBu === null ? null : Number(p.precoEntradaUsdBu), 'US$ ')}
                  </td>
                  <td className="p-3 text-right t-num-sm">
                    {fmt(Number(ult?.precoMercadoUsdBu ?? null), 'US$ ')}
                  </td>
                  <td
                    className={`p-3 text-right t-num-sm ${pnl >= 0 ? 'text-pos' : 'text-neg'}`}
                  >
                    {fmt(pnl, 'R$ ')}
                  </td>
                  <td className="p-3">
                    <Chip
                      variant={
                        p.status === 'aberta'
                          ? 'pos'
                          : p.status === 'fechada'
                            ? 'neutral'
                            : 'neutral'
                      }
                    >
                      {p.status}
                    </Chip>
                  </td>
                </tr>
              )
            })}
            {posicoes.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-fg-3">
                  Sem posições com esses filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </AppShell>
  )
}
