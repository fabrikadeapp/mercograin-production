import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getPortalSession } from '@/lib/portal-produtor/auth'
import { PropostaAceiteActions } from './_components/PropostaAceiteActions'
import { PropostaTimeline } from './_components/PropostaTimeline'

interface GraoItem {
  grao?: string
  quantidade?: number
  preco?: number
  subtotal?: number
}

const STATUS_LABEL: Record<string, string> = {
  enviada: 'Aguardando seu aceite',
  em_negociacao: 'Em negociação',
  aceita: 'Aceita',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  expirada: 'Expirada',
}

export default async function PropostaDetailPage({
  params,
}: {
  params: { workspaceSlug: string; id: string }
}) {
  const sess = await getPortalSession()
  if (!sess) redirect(`/portal/${params.workspaceSlug}/login`)

  const proposta = await db.proposta.findFirst({
    where: {
      id: params.id,
      clienteId: sess.clienteId,
      workspaceId: sess.workspaceId,
    },
    select: {
      id: true,
      numero: true,
      tipo: true,
      status: true,
      valorTotal: true,
      validadeEm: true,
      criadaEm: true,
      descricao: true,
      graos: true,
      localEntrega: true,
      origem: true,
    },
  })

  if (!proposta) notFound()

  const graos = (Array.isArray(proposta.graos) ? proposta.graos : []) as GraoItem[]
  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const podeDecidir = proposta.status === 'enviada' || proposta.status === 'em_negociacao'

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/portal/${params.workspaceSlug}/propostas`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Voltar para propostas
        </Link>
      </div>

      <header className="rounded-lg border bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">Proposta</p>
            <h1 className="text-3xl font-semibold tabular-nums">{proposta.numero}</h1>
            <p className="mt-1 text-sm capitalize text-gray-600">
              {proposta.tipo} · criada em{' '}
              {new Date(proposta.criadaEm).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-gray-500">Status</p>
            <p className="text-base font-semibold">
              {STATUS_LABEL[proposta.status] ?? proposta.status}
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Itens</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500">
            <tr>
              <th className="pb-2">Grão</th>
              <th className="pb-2">Quantidade</th>
              <th className="pb-2">Preço unitário</th>
              <th className="pb-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {graos.map((g, i) => (
              <tr key={i} className="border-t">
                <td className="py-2 capitalize">{g.grao ?? '—'}</td>
                <td className="py-2 tabular-nums">
                  {g.quantidade != null ? `${Number(g.quantidade).toFixed(3)} t` : '—'}
                </td>
                <td className="py-2 tabular-nums">
                  {g.preco != null ? `${fmt(Number(g.preco))} / t` : '—'}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {g.subtotal != null ? fmt(Number(g.subtotal)) : '—'}
                </td>
              </tr>
            ))}
            <tr className="border-t font-semibold">
              <td className="py-3" colSpan={3}>
                Valor total
              </td>
              <td className="py-3 text-right tabular-nums text-green-700">
                {fmt(Number(proposta.valorTotal))}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-white p-6">
          <p className="text-xs uppercase tracking-wider text-gray-500">Validade</p>
          <p className="mt-1 text-lg font-medium">
            {new Date(proposta.validadeEm).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <p className="text-xs uppercase tracking-wider text-gray-500">Local</p>
          <p className="mt-1 text-lg font-medium">
            {proposta.localEntrega ?? proposta.origem ?? '—'}
          </p>
        </div>
      </section>

      {proposta.descricao && (
        <section className="rounded-lg border bg-white p-6">
          <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">
            Observações
          </p>
          <p className="text-sm whitespace-pre-wrap">{proposta.descricao}</p>
        </section>
      )}

      {podeDecidir && (
        <PropostaAceiteActions
          propostaId={proposta.id}
          workspaceSlug={params.workspaceSlug}
        />
      )}

      {!podeDecidir && proposta.status !== 'aprovada' && proposta.status !== 'aceita' && (
        <section className="rounded-lg border bg-gray-50 p-4 text-center text-sm text-gray-600">
          Esta proposta não está mais disponível para aceite.
        </section>
      )}

      {(proposta.status === 'aprovada' || proposta.status === 'aceita') && (
        <section className="rounded-lg border bg-green-50 p-4 text-center text-sm text-green-800">
          ✓ Você aceitou esta proposta. O contrato está sendo preparado e você receberá
          aviso para assinar.
        </section>
      )}

      <PropostaTimeline propostaId={proposta.id} />
    </div>
  )
}
