import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getPortalSession } from '@/lib/portal-produtor/auth'

export default async function ContratosPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const sess = await getPortalSession()
  if (!sess) redirect(`/portal/${params.workspaceSlug}/login`)
  const contratos = await db.contrato.findMany({
    where: { clienteId: sess.clienteId, workspaceId: sess.workspaceId },
    orderBy: { criadoEm: 'desc' },
    include: { proposta: { select: { valorTotal: true, tipo: true } } },
  })
  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Meus contratos</h1>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Número</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Status</th>
              <th className="p-2">Valor</th>
              <th className="p-2">Criado em</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {contratos.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2 font-mono">{c.numero}</td>
                <td className="p-2">{c.proposta?.tipo ?? '-'}</td>
                <td className="p-2">{c.statusAssinatura ?? 'rascunho'}</td>
                <td className="p-2">{fmt(Number(c.proposta?.valorTotal ?? 0))}</td>
                <td className="p-2">{new Date(c.criadoEm).toLocaleDateString('pt-BR')}</td>
                <td className="p-2">
                  <Link href={`/portal/${params.workspaceSlug}/contratos/${c.id}`} className="text-green-700 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {contratos.length === 0 && (
              <tr><td colSpan={6} className="p-3 text-center text-gray-500">Sem contratos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
