import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, Chip, ProgressBar } from '@/components/ui/phb'
import { NovoAdiantamentoDialog } from '../_components/NovoAdiantamentoDialog'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto',
  parcial: 'Parcial',
  quitado: 'Quitado',
  inadimplente: 'Inadimplente',
}

const STATUS_VARIANT: Record<string, 'pos' | 'neg' | 'neutral' | 'warn'> = {
  aberto: 'neutral',
  parcial: 'warn',
  quitado: 'pos',
  inadimplente: 'neg',
}

function fmtBRL(v: any) {
  return Number(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export default async function AdiantamentosPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const where: any = scope.whereOwn()
  if (searchParams.status && STATUS_LABEL[searchParams.status]) {
    where.status = searchParams.status
  }

  const [adiantamentos, contratos, produtores] = await Promise.all([
    db.adiantamento.findMany({
      where,
      include: {
        produtor: { select: { id: true, nome: true, cnpj: true } },
        contrato: { select: { id: true, numero: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.contrato.findMany({
      where: { ...scope.whereOwn(), statusAssinatura: { not: 'cancelado' } },
      select: { id: true, numero: true, clienteId: true },
      orderBy: { criadoEm: 'desc' },
      take: 300,
    }),
    db.cliente.findMany({
      where: {
        ...scope.whereOwn(),
        ativo: true,
        tipo: { in: ['vendedor', 'ambos'] },
      },
      select: { id: true, nome: true, cnpj: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  return (
    <AppShell>
      <PageHeader
        eyebrow="Originação · Adiantamentos"
        title="Adiantamentos ao Produtor"
        subtitle="Cash ou insumo antes da entrega — quitação pelo grão recebido."
        actions={
          <NovoAdiantamentoDialog contratos={contratos} produtores={produtores} />
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <Link
          href="/originacao/adiantamentos"
          className={`px-3 py-1.5 rounded-md text-small border ${
            !searchParams.status
              ? 'bg-bg-2 border-border-2 text-fg-1'
              : 'border-border-1 text-fg-3 hover:text-fg-1'
          }`}
        >
          Todos
        </Link>
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <Link
            key={k}
            href={`/originacao/adiantamentos?status=${k}`}
            className={`px-3 py-1.5 rounded-md text-small border ${
              searchParams.status === k
                ? 'bg-bg-2 border-border-2 text-fg-1'
                : 'border-border-1 text-fg-3 hover:text-fg-1'
            }`}
          >
            {v}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-fg-3 text-micro uppercase tracking-wider border-b border-border-1">
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Produtor</th>
              <th className="px-4 py-3">Contrato</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Esperado (sc)</th>
              <th className="px-4 py-3 text-right">Abatido (sc)</th>
              <th className="px-4 py-3">Progresso</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {adiantamentos.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-fg-3">
                  Nenhum adiantamento.
                </td>
              </tr>
            )}
            {adiantamentos.map((a) => {
              const pct =
                a.qtdEsperadaSc > 0
                  ? (a.qtdAbatidaSc / a.qtdEsperadaSc) * 100
                  : 0
              return (
                <tr
                  key={a.id}
                  className="border-b border-border-1 hover:bg-bg-2/40"
                >
                  <td className="px-4 py-3 font-mono text-fg-1">{a.numero}</td>
                  <td className="px-4 py-3 text-fg-2">
                    {a.produtor.nome}
                    <div className="text-micro text-fg-3">
                      {a.produtor.cnpj}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/contratos/${a.contratoId}`}
                      className="text-fg-2 hover:text-emerald-400 font-mono text-small"
                    >
                      {a.contrato.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-fg-3 capitalize">{a.tipo}</td>
                  <td className="px-4 py-3 text-right t-num">
                    {fmtBRL(a.valor)}
                  </td>
                  <td className="px-4 py-3 text-right t-num">
                    {a.qtdEsperadaSc.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right t-num">
                    {a.qtdAbatidaSc.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 min-w-[140px]">
                    <ProgressBar value={pct} />
                    <span className="text-micro text-fg-3">
                      {pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-fg-3">
                    {a.dataPrevistaQuit
                      ? new Date(a.dataPrevistaQuit).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Chip variant={STATUS_VARIANT[a.status] || 'neutral'}>
                      {STATUS_LABEL[a.status] || a.status}
                    </Chip>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </AppShell>
  )
}
