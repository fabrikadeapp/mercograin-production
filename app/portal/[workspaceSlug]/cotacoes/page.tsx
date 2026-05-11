import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getPortalSession } from '@/lib/portal-produtor/auth'

export default async function CotacoesPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const sess = await getPortalSession()
  if (!sess) redirect(`/portal/${params.workspaceSlug}/login`)
  const cotacoes = await db.cotacao.findMany({ orderBy: { data: 'desc' }, take: 30 })
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Cotações</h1>
      <p className="text-sm text-gray-500">Consulta — para fixar entre em contato com sua corretora.</p>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Grão</th>
              <th className="p-2">Preço</th>
              <th className="p-2">Símbolo</th>
              <th className="p-2">USD/BRL</th>
              <th className="p-2">Data</th>
            </tr>
          </thead>
          <tbody>
            {cotacoes.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{c.grao}</td>
                <td className="p-2">{Number(c.preco).toLocaleString('pt-BR')}</td>
                <td className="p-2">{c.simbolo}</td>
                <td className="p-2">{c.dolarReal ? Number(c.dolarReal).toLocaleString('pt-BR') : '-'}</td>
                <td className="p-2">{new Date(c.data).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
