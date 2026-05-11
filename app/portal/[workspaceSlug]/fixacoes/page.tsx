import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getPortalSession } from '@/lib/portal-produtor/auth'

export default async function FixacoesPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const sess = await getPortalSession()
  if (!sess) redirect(`/portal/${params.workspaceSlug}/login`)

  const contratos = await db.contrato.findMany({
    where: { clienteId: sess.clienteId, workspaceId: sess.workspaceId },
    select: { id: true, numero: true },
  })
  const contratoIds = contratos.map((c) => c.id)

  const contratoFixacoes = contratoIds.length
    ? await (db as any).contratoFixacao
        .findMany({ where: { contratoId: { in: contratoIds } } })
        .catch(() => [])
    : []
  const fixacoes = await (db as any).fixacao
    .findMany({
      where: { workspaceId: sess.workspaceId, clienteId: sess.clienteId },
      orderBy: { createdAt: 'desc' },
    })
    .catch(() => [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Fixações</h1>

      <section>
        <h2 className="mb-2 text-lg font-medium">Contratos com fixação parcial</h2>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2">Contrato</th>
                <th className="p-2">Sacas fixadas</th>
                <th className="p-2">Sacas pendentes</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {contratoFixacoes.map((f: any) => (
                <tr key={f.id} className="border-t">
                  <td className="p-2 font-mono">{contratos.find((c) => c.id === f.contratoId)?.numero}</td>
                  <td className="p-2">{f.sacasFixadas ?? 0}</td>
                  <td className="p-2">{f.sacasPendentes ?? 0}</td>
                  <td className="p-2">{f.status ?? '-'}</td>
                </tr>
              ))}
              {contratoFixacoes.length === 0 && (
                <tr><td colSpan={4} className="p-3 text-center text-gray-500">Sem fixações.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Histórico de fixações</h2>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-2">Data</th>
                <th className="p-2">Sacas</th>
                <th className="p-2">Preço</th>
                <th className="p-2">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {fixacoes.map((f: any) => (
                <tr key={f.id} className="border-t">
                  <td className="p-2">{new Date(f.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="p-2">{f.sacas ?? 0}</td>
                  <td className="p-2">{Number(f.preco ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td className="p-2">{f.tipo ?? '-'}</td>
                </tr>
              ))}
              {fixacoes.length === 0 && (
                <tr><td colSpan={4} className="p-3 text-center text-gray-500">Sem registros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
