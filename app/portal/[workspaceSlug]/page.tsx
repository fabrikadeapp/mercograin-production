import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/portal-produtor/auth'
import { kpisProdutor } from '@/lib/bi/produtor'

export default async function PortalDashboard({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const sess = await getPortalSession()
  if (!sess) redirect(`/portal/${params.workspaceSlug}/login`)
  let kpis
  try {
    kpis = await kpisProdutor(sess.clienteId)
  } catch {
    return <div>Erro ao carregar KPIs.</div>
  }
  const fmtBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const cards: [string, string | number][] = [
    ['Contratos ativos', kpis.contratosAtivos],
    ['Contratos fechados', kpis.contratosFechados],
    ['Sacas safra atual', kpis.qtdSafraAtual.toLocaleString('pt-BR')],
    ['Valor recebido', fmtBRL(kpis.valorRecebido)],
    ['Valor a receber', fmtBRL(kpis.valorAReceber)],
    ['Pontualidade pagto.', `${kpis.recebimentosPontualidade.toFixed(0)}%`],
  ]
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Olá, {kpis.nome}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-white p-4">
            <div className="text-xs uppercase text-gray-500">{label}</div>
            <div className="mt-1 text-xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <section>
        <h2 className="mb-2 text-lg font-medium">Últimos contratos</h2>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2">Número</th>
                <th className="p-2">Status</th>
                <th className="p-2">Valor</th>
                <th className="p-2">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {kpis.ultimosContratos.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2 font-mono">{c.numero}</td>
                  <td className="p-2">{c.status}</td>
                  <td className="p-2">{fmtBRL(c.valor)}</td>
                  <td className="p-2">{new Date(c.criadoEm).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
              {kpis.ultimosContratos.length === 0 && (
                <tr><td colSpan={4} className="p-3 text-center text-gray-500">Sem contratos ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
