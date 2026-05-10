import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, Chip } from '@/components/ui/phb'
import { NovoBarterDialog } from '../_components/NovoBarterDialog'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  entregue: 'Entregue',
  recebido_grao: 'Grão recebido',
  cancelado: 'Cancelado',
}
const STATUS_VARIANT: Record<string, 'pos' | 'neg' | 'neutral' | 'warn'> = {
  pendente: 'neutral',
  entregue: 'warn',
  recebido_grao: 'pos',
  cancelado: 'neg',
}

function fmtBRL(v: any) {
  return Number(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export default async function BarterPage({
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

  const [items, contratos, fornecedores] = await Promise.all([
    db.barterInsumo.findMany({
      where,
      include: {
        fornecedor: { select: { id: true, razaoSocial: true } },
        contrato: { select: { id: true, numero: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.contrato.findMany({
      where: { ...scope.whereOwn(), statusAssinatura: { not: 'cancelado' } },
      select: { id: true, numero: true },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    }),
    db.fornecedor.findMany({
      where: {
        ...scope.whereOwn(),
        ativo: true,
        tipo: { in: ['insumos', 'outros'] },
      },
      select: { id: true, razaoSocial: true },
      orderBy: { razaoSocial: 'asc' },
    }),
  ])

  return (
    <AppShell>
      <PageHeader
        eyebrow="Originação · Barter"
        title="Insumos por Grão"
        subtitle="Insumos entregues ao produtor convertidos em sacas equivalentes."
        actions={
          <NovoBarterDialog contratos={contratos} fornecedores={fornecedores} />
        }
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <Link
          href="/originacao/barter"
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
            href={`/originacao/barter?status=${k}`}
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
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Fornecedor</th>
              <th className="px-4 py-3">Contrato</th>
              <th className="px-4 py-3 text-right">Qtd</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Preço grão (R$/sc)</th>
              <th className="px-4 py-3 text-right">Equiv. (sc)</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-fg-3">
                  Nenhum barter cadastrado.
                </td>
              </tr>
            )}
            {items.map((b) => (
              <tr
                key={b.id}
                className="border-b border-border-1 hover:bg-bg-2/40"
              >
                <td className="px-4 py-3 text-fg-1">{b.descricao}</td>
                <td className="px-4 py-3 text-fg-2">
                  {b.fornecedor?.razaoSocial || '—'}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/contratos/${b.contratoId}`}
                    className="text-fg-2 hover:text-emerald-400 font-mono text-small"
                  >
                    {b.contrato.numero}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right t-num">
                  {b.quantidade.toLocaleString('pt-BR')} {b.unidade}
                </td>
                <td className="px-4 py-3 text-right t-num">
                  {fmtBRL(b.valorTotal)}
                </td>
                <td className="px-4 py-3 text-right t-num">
                  {b.precoFixadoSc.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-3 text-right t-num">
                  {b.qtdGraoEquivalenteSc.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-3">
                  <Chip variant={STATUS_VARIANT[b.status] || 'neutral'}>
                    {STATUS_LABEL[b.status] || b.status}
                  </Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  )
}
