/**
 * HistoricoChart — server component que lê os últimos 30 snapshots persistidos
 * pelo cron diário (`/api/cron/sync-cotacoes`) e renderiza sparklines por grão.
 *
 * Reusa o `LineChart` SVG existente em `components/charts/LineChart.tsx`.
 * Fonte: tabela `Cotacao` (fonte = 'CEPEA-ESALQ').
 */
import { db } from '@/lib/db'
import { Card, CardHeader, CardTitle } from '@/components/ui/phb'
import { LineChart } from '@/components/charts/LineChart'

type Grao = 'soja' | 'milho' | 'trigo'

const TITULO: Record<Grao, string> = {
  soja: 'Soja · CEPEA Paranaguá (R$/sc 60kg)',
  milho: 'Milho · CEPEA (R$/sc 60kg)',
  trigo: 'Trigo · CEPEA PR (R$/sc 60kg)',
}

const COR: Record<Grao, string> = {
  soja: '#16a34a',
  milho: '#eab308',
  trigo: '#a16207',
}

async function loadSerie(grao: Grao) {
  const rows = await db.cotacao.findMany({
    where: { grao },
    orderBy: { data: 'desc' },
    take: 30,
    select: { data: true, preco: true },
  })
  // Reverte para ordem cronológica e formata para o LineChart
  return rows.reverse().map((r) => ({
    label: r.data.toISOString().slice(5, 10), // MM-DD
    value: Number(r.preco),
  }))
}

export async function HistoricoChart({ graos = ['soja', 'milho', 'trigo'] as Grao[] }: {
  graos?: Grao[]
}) {
  const series = await Promise.all(graos.map(async (g) => ({ grao: g, data: await loadSerie(g) })))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {series.map(({ grao, data }) => (
        <Card key={grao}>
          <CardHeader>
            <CardTitle eyebrow="Histórico · 30 dias">{TITULO[grao]}</CardTitle>
          </CardHeader>
          <div className="px-4 pb-4">
            {data.length === 0 ? (
              <div className="text-sm text-gray-500 py-6 text-center">
                Sem histórico ainda — aguarde primeiro sync diário.
              </div>
            ) : (
              <LineChart data={data} title={TITULO[grao]} color={COR[grao]} />
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
