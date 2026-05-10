import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { calcularDRE } from '@/lib/compliance/dre'
import { db } from '@/lib/db'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ inicio?: string; fim?: string; safraId?: string; cultura?: string }>
}

function fmt(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export default async function DREPage({ searchParams }: Props) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const sp = await searchParams
  const hoje = new Date()
  const inicio = sp.inicio ? new Date(sp.inicio) : new Date(hoje.getFullYear(), 0, 1)
  const fim = sp.fim ? new Date(sp.fim) : hoje

  const dre = await calcularDRE({
    workspaceId: scope.workspaceId,
    inicio,
    fim,
    safraId: sp.safraId,
    cultura: sp.cultura,
  })

  const safras = await db.safra.findMany({
    where: scope.whereOwn(),
    orderBy: { inicio: 'desc' },
  })

  const linhas: Array<{ label: string; valor: number; bold?: boolean; level?: number }> = [
    { label: 'Receita Bruta de Vendas', valor: dre.receitaBrutaVendas, level: 1 },
    { label: 'Receita de Comissões', valor: dre.receitaComissoes, level: 1 },
    { label: 'Receita Total Bruta', valor: dre.receitaTotalBruta, bold: true },
    { label: '(-) Deduções/Impostos', valor: -dre.deducoesImpostos, level: 1 },
    { label: 'Receita Líquida', valor: dre.receitaLiquida, bold: true },
    { label: '(-) Custo Mercadoria Vendida', valor: -dre.custoMercadoriaVendida, level: 1 },
    { label: 'Lucro Bruto', valor: dre.lucroBruto, bold: true },
    { label: '(-) Despesas Comerciais', valor: -dre.despesasComerciais, level: 1 },
    { label: '(-) Despesas Administrativas', valor: -dre.despesasAdministrativas, level: 1 },
    { label: '(-) Despesas Operacionais', valor: -dre.despesasOperacionais, level: 1 },
    { label: 'Resultado Operacional', valor: dre.resultadoOperacional, bold: true },
    { label: 'Resultado Financeiro', valor: dre.resultadoFinanceiro, level: 1 },
    { label: 'Lucro antes IR', valor: dre.lucroAntesIR, bold: true },
    { label: '(-) Provisão IR (15%)', valor: -dre.provisaoIR, level: 1 },
    { label: 'Lucro Líquido', valor: dre.lucroLiquido, bold: true },
  ]

  return (
    <AppShell>
      <PageHeader
        title="DRE — Demonstração do Resultado"
        subtitle={`${inicio.toLocaleDateString('pt-BR')} → ${fim.toLocaleDateString('pt-BR')}`}
      />

      <form className="flex flex-wrap gap-2 items-end mb-4" method="get">
        <label className="text-xs flex flex-col">
          Início
          <input
            name="inicio"
            type="date"
            defaultValue={inicio.toISOString().slice(0, 10)}
            className="border rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs flex flex-col">
          Fim
          <input
            name="fim"
            type="date"
            defaultValue={fim.toISOString().slice(0, 10)}
            className="border rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs flex flex-col">
          Safra
          <select name="safraId" defaultValue={sp.safraId || ''} className="border rounded px-2 py-1 text-sm">
            <option value="">Todas</option>
            {safras.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} {s.cultura}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs flex flex-col">
          Cultura
          <select name="cultura" defaultValue={sp.cultura || ''} className="border rounded px-2 py-1 text-sm">
            <option value="">Todas</option>
            <option value="soja">Soja</option>
            <option value="milho">Milho</option>
            <option value="trigo">Trigo</option>
          </select>
        </label>
        <button
          type="submit"
          className="px-3 py-1.5 text-sm bg-zinc-900 text-white rounded"
        >
          Atualizar
        </button>
      </form>

      <Card>
        <div className="p-4">
          <table className="w-full text-sm">
            <tbody>
              {linhas.map((l, i) => (
                <tr
                  key={i}
                  className={
                    'border-b last:border-0 ' +
                    (l.bold ? 'font-semibold bg-zinc-50' : '')
                  }
                >
                  <td className="py-2" style={{ paddingLeft: (l.level || 0) * 16 + 8 }}>
                    {l.label}
                  </td>
                  <td
                    className={
                      'py-2 pr-4 text-right font-mono ' +
                      (l.valor < 0 ? 'text-red-600' : '')
                    }
                  >
                    {fmt(l.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {dre.porSafra.length > 0 && (
        <Card className="mt-4">
          <div className="p-4">
            <h3 className="font-semibold text-sm mb-3">Resultado por safra</h3>
            <ul className="text-sm divide-y">
              {dre.porSafra.map((s) => {
                const safra = safras.find((x) => x.id === s.safraId)
                return (
                  <li key={s.safraId} className="flex justify-between py-1.5">
                    <span>{safra ? `${safra.nome} ${safra.cultura}` : s.safraId}</span>
                    <span className={'font-mono ' + (s.lucro < 0 ? 'text-red-600' : '')}>
                      {fmt(s.lucro)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </Card>
      )}
    </AppShell>
  )
}
