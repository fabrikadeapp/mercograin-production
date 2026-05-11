import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, Chip } from '@/components/ui/phb'
import { ProgressBar } from '@/components/ui/phb'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  parcial: 'Parcial',
  totalmente_fixado: 'Totalmente fixado',
  cancelado: 'Cancelado',
}

const STATUS_VARIANT: Record<string, 'pos' | 'neg' | 'neutral'> = {
  pendente: 'neutral',
  parcial: 'pos',
  totalmente_fixado: 'pos',
  cancelado: 'neg',
}

function formatDate(d?: Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

export default async function FixacoesPage({
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
    where.statusFixacao = searchParams.status
  }

  const fixacoes = await db.contratoFixacao.findMany({
    where,
    include: {
      contrato: {
        select: {
          id: true,
          numero: true,
          modalidade: true,
          cliente: { select: { id: true, nome: true } },
        },
      },
      _count: { select: { fixacoes: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return (
    <AppShell>
      <PageHeader
        eyebrow="Originação · Fixações"
        title="Contratos a Fixar"
        subtitle="Acompanhe contratos com preço a fixar, janelas e progresso de fixação."
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <Link
          href="/originacao/fixacoes"
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
            href={`/originacao/fixacoes?status=${k}`}
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
              <th className="px-4 py-3">Contrato</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3 text-right">Total (sc)</th>
              <th className="px-4 py-3 text-right">Fixada (sc)</th>
              <th className="px-4 py-3">Progresso</th>
              <th className="px-4 py-3">Janela</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {fixacoes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-fg-3">
                  <p className="text-fg-2 font-medium mb-1">Nenhum contrato a fixar</p>
                  <p className="text-micro text-fg-3">
                    Fixações são geradas automaticamente quando você cria um contrato com modalidade <strong>&quot;Preço a fixar&quot;</strong>. <br />
                    <Link href="/contratos/novo" className="text-accent hover:underline">
                      → Criar contrato a fixar
                    </Link>
                  </p>
                </td>
              </tr>
            )}
            {fixacoes.map((f) => {
              const pct =
                f.qtdTotalSc > 0 ? (f.qtdFixadaSc / f.qtdTotalSc) * 100 : 0
              return (
                <tr
                  key={f.id}
                  className="border-b border-border-1 hover:bg-bg-2/40"
                >
                  <td className="px-4 py-3 font-mono text-fg-1">
                    <Link
                      href={`/contratos/${f.contratoId}`}
                      className="hover:text-emerald-400"
                    >
                      {f.contrato.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-fg-2">
                    {f.contrato.cliente.nome}
                  </td>
                  <td className="px-4 py-3 text-right t-num">
                    {f.qtdTotalSc.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right t-num">
                    {f.qtdFixadaSc.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 min-w-[160px]">
                    <ProgressBar value={pct} />
                    <span className="text-micro text-fg-3">
                      {pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-fg-3">
                    {formatDate(f.fixacaoInicio)} → {formatDate(f.fixacaoFim)}
                  </td>
                  <td className="px-4 py-3">
                    <Chip variant={STATUS_VARIANT[f.statusFixacao] || 'neutral'}>
                      {STATUS_LABEL[f.statusFixacao] || f.statusFixacao}
                    </Chip>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/contratos/${f.contratoId}`}
                      className="text-emerald-400 hover:underline text-small"
                    >
                      Detalhes
                    </Link>
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
