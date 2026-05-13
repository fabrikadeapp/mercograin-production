import { db } from '@/lib/db'
import { PageHeader, Card } from '@/components/ui/phb'

export const dynamic = 'force-dynamic'

interface CommodityAgg {
  receita: number
  margem: number[] // valores válidos para média
  count: number
  sucessos: number
}

export default async function CommodityPage() {
  const propostas = await db.proposta.findMany({
    select: { graos: true, valorTotal: true, status: true, margemPercent: true },
    take: 10000,
  })

  const agg = new Map<string, CommodityAgg>()
  for (const p of propostas) {
    const g = p.graos as { commodity?: string } | null
    const k = g?.commodity ?? '—'
    const cur = agg.get(k) ?? { receita: 0, margem: [], count: 0, sucessos: 0 }
    cur.count += 1
    cur.receita += Number(p.valorTotal)
    if (p.margemPercent != null) cur.margem.push(Number(p.margemPercent))
    if (['sucesso', 'aceita', 'concluido', 'faturado'].includes(p.status.toLowerCase())) cur.sucessos += 1
    agg.set(k, cur)
  }
  const rows = Array.from(agg.entries())
    .map(([commodity, a]) => ({
      commodity,
      receita: a.receita,
      margemMedia: a.margem.length > 0 ? a.margem.reduce((x, y) => x + y, 0) / a.margem.length : null,
      conversao: a.count > 0 ? a.sucessos / a.count : 0,
      count: a.count,
    }))
    .sort((a, b) => b.receita - a.receita)

  return (
    <div>
      <PageHeader eyebrow="BH Grain" title="Análise por commodity" subtitle="Consolidado de todas as propostas" />
      <Card className="p-0 mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-black/10">
              <th className="px-3 py-2">Commodity</th>
              <th className="px-3 py-2 text-right">Receita proposta</th>
              <th className="px-3 py-2 text-right">Margem média</th>
              <th className="px-3 py-2 text-right">Conversão</th>
              <th className="px-3 py-2 text-right">Propostas</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center opacity-60">Sem propostas.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.commodity} className="border-t border-white/5">
                  <td className="px-3 py-2">{r.commodity}</td>
                  <td className="px-3 py-2 text-right tabular-nums">R$ {r.receita.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.margemMedia != null ? `${r.margemMedia.toFixed(2)}%` : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Math.round(r.conversao * 100)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
