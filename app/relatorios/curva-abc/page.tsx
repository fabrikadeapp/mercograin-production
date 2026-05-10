import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { calcularCurvaABC } from '@/lib/compliance/curva-abc'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ tipo?: string }>
}

export default async function CurvaABCPage({ searchParams }: Props) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const sp = await searchParams
  const tipo = (sp.tipo as 'clientes' | 'fornecedores' | 'produtos') || 'clientes'

  let itens: { id: string; nome: string; total: number }[] = []
  if (tipo === 'clientes') {
    const clientes = await db.cliente.findMany({
      where: scope.whereOwn(),
      include: {
        contratos: { select: { proposta: { select: { valorTotal: true } } } },
      },
    })
    itens = clientes.map((c) => ({
      id: c.id,
      nome: c.nome,
      total: c.contratos.reduce(
        (s, ct) => s + Number(ct.proposta?.valorTotal || 0),
        0
      ),
    }))
  } else if (tipo === 'fornecedores') {
    const fs = await db.fornecedor.findMany({
      where: scope.whereOwn(),
      include: { royalties: { select: { valorTotal: true } } },
    })
    itens = fs.map((f) => ({
      id: f.id,
      nome: f.razaoSocial,
      total: f.royalties.reduce((s, r) => s + Number(r.valorTotal), 0),
    }))
  } else {
    const tickets = await db.ticketBalanca.findMany({
      where: { ...scope.whereOwn(), status: 'finalizado' },
      select: { cultura: true, pesoLiquidoKg: true },
    })
    const map = new Map<string, number>()
    for (const t of tickets) {
      map.set(t.cultura, (map.get(t.cultura) || 0) + (t.pesoLiquidoKg || 0) / 60)
    }
    itens = Array.from(map.entries()).map(([cultura, total]) => ({
      id: cultura,
      nome: cultura,
      total,
    }))
  }

  const curva = calcularCurvaABC(itens, (x) => x.total)
  const corA = '#10b981'
  const corB = '#f59e0b'
  const corC = '#ef4444'
  const cor = (c: 'A' | 'B' | 'C') => (c === 'A' ? corA : c === 'B' ? corB : corC)

  return (
    <AppShell>
      <PageHeader
        title="Curva ABC"
        subtitle={`Análise Pareto — ${tipo}`}
      />

      <div className="flex gap-2 mb-4 text-sm">
        {(['clientes', 'fornecedores', 'produtos'] as const).map((t) => (
          <Link
            key={t}
            href={`/relatorios/curva-abc?tipo=${t}`}
            className={
              'px-3 py-1.5 rounded ' +
              (tipo === t
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-700')
            }
          >
            {t}
          </Link>
        ))}
      </div>

      <Card>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b">
                <th className="py-2">#</th>
                <th>Item</th>
                <th className="text-right">Valor</th>
                <th className="text-right">%</th>
                <th className="text-right">% Acum.</th>
                <th>Classe</th>
              </tr>
            </thead>
            <tbody>
              {curva.map((row, i) => (
                <tr key={row.item.id} className="border-b last:border-0">
                  <td className="py-1.5 text-zinc-400">{i + 1}</td>
                  <td>{row.item.nome}</td>
                  <td className="text-right font-mono">
                    {tipo === 'produtos'
                      ? `${row.valor.toFixed(0)} sc`
                      : `R$ ${row.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  </td>
                  <td className="text-right">{row.percentual}%</td>
                  <td className="text-right">{row.percentualAcumulado}%</td>
                  <td>
                    <span
                      className="px-2 py-0.5 rounded text-white text-xs font-semibold"
                      style={{ background: cor(row.classificacao) }}
                    >
                      {row.classificacao}
                    </span>
                  </td>
                </tr>
              ))}
              {curva.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-zinc-500">
                    Sem dados.
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
