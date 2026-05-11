import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getPortalSession } from '@/lib/portal-produtor/auth'

export default async function ContratoDetalhe({
  params,
}: {
  params: { workspaceSlug: string; id: string }
}) {
  const sess = await getPortalSession()
  if (!sess) redirect(`/portal/${params.workspaceSlug}/login`)
  const c = await db.contrato.findFirst({
    where: { id: params.id, clienteId: sess.clienteId, workspaceId: sess.workspaceId },
    include: { proposta: true },
  })
  if (!c) notFound()
  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Contrato {c.numero}</h1>
      <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-white p-4 text-sm md:grid-cols-3">
        <div><dt className="text-gray-500">Status assinatura</dt><dd className="font-medium">{c.statusAssinatura ?? 'rascunho'}</dd></div>
        <div><dt className="text-gray-500">Assinado em</dt><dd>{c.assinadoEm ? new Date(c.assinadoEm).toLocaleString('pt-BR') : '-'}</dd></div>
        <div><dt className="text-gray-500">Data início</dt><dd>{c.dataInicio ? new Date(c.dataInicio).toLocaleDateString('pt-BR') : '-'}</dd></div>
        <div><dt className="text-gray-500">Data fim</dt><dd>{c.dataFim ? new Date(c.dataFim).toLocaleDateString('pt-BR') : '-'}</dd></div>
        <div><dt className="text-gray-500">Modalidade</dt><dd>{c.modalidade ?? '-'}</dd></div>
        <div><dt className="text-gray-500">Valor total</dt><dd className="font-semibold">{fmt(Number(c.proposta?.valorTotal ?? 0))}</dd></div>
      </dl>
      {c.pdfUrl && (
        <a href={c.pdfUrl} target="_blank" rel="noreferrer" className="inline-block rounded bg-green-700 px-4 py-2 text-white">
          Baixar PDF
        </a>
      )}
    </div>
  )
}
