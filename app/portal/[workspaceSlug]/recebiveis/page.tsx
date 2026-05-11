import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getPortalSession } from '@/lib/portal-produtor/auth'

export default async function RecebiveisPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const sess = await getPortalSession()
  if (!sess) redirect(`/portal/${params.workspaceSlug}/login`)
  const boletos = await db.boleto.findMany({
    where: { clienteId: sess.clienteId, workspaceId: sess.workspaceId },
    orderBy: { vencimento: 'desc' },
    take: 200,
  })
  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const total = boletos
    .filter((b) => b.status !== 'pago')
    .reduce((s, b) => s + Number(b.valor), 0)
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Recebíveis</h1>
      <div className="rounded-lg border bg-white p-4">
        <div className="text-xs text-gray-500">Total em aberto</div>
        <div className="text-2xl font-semibold">{fmt(total)}</div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Vencimento</th>
              <th className="p-2">Valor</th>
              <th className="p-2">Status</th>
              <th className="p-2">Pago em</th>
            </tr>
          </thead>
          <tbody>
            {boletos.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-2">{new Date(b.vencimento).toLocaleDateString('pt-BR')}</td>
                <td className="p-2">{fmt(Number(b.valor))}</td>
                <td className="p-2">{b.status}</td>
                <td className="p-2">{b.confirmadoEm ? new Date(b.confirmadoEm).toLocaleDateString('pt-BR') : '-'}</td>
              </tr>
            ))}
            {boletos.length === 0 && (
              <tr><td colSpan={4} className="p-3 text-center text-gray-500">Sem boletos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
