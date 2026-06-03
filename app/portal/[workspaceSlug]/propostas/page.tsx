import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getPortalSession } from '@/lib/portal-produtor/auth'

const STATUS_VISIVEIS = ['enviada', 'em_negociacao', 'aceita', 'aprovada', 'recusada', 'expirada']

const STATUS_LABEL: Record<string, string> = {
  enviada: 'Aguardando seu aceite',
  em_negociacao: 'Em negociação',
  aceita: 'Aceita',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  expirada: 'Expirada',
}

const STATUS_CHIP: Record<string, { bg: string; fg: string }> = {
  enviada: { bg: '#FEF3C7', fg: '#92400E' },
  em_negociacao: { bg: '#DBEAFE', fg: '#1E40AF' },
  aceita: { bg: '#D1FAE5', fg: '#065F46' },
  aprovada: { bg: '#D1FAE5', fg: '#065F46' },
  recusada: { bg: '#FEE2E2', fg: '#991B1B' },
  expirada: { bg: '#E5E7EB', fg: '#374151' },
}

interface GraoItem {
  grao?: string
  quantidade?: number
  preco?: number
  subtotal?: number
}

export default async function PropostasPortalPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const sess = await getPortalSession()
  if (!sess) redirect(`/portal/${params.workspaceSlug}/login`)

  const propostas = await db.proposta.findMany({
    where: {
      clienteId: sess.clienteId,
      workspaceId: sess.workspaceId,
      status: { in: STATUS_VISIVEIS },
    },
    orderBy: { criadaEm: 'desc' },
    select: {
      id: true,
      numero: true,
      tipo: true,
      valorTotal: true,
      status: true,
      validadeEm: true,
      criadaEm: true,
      graos: true,
    },
  })

  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Minhas propostas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Propostas que você recebeu. Acesse cada uma para aceitar ou recusar.
          </p>
        </div>
        <div className="rounded-full border bg-white px-3 py-1 text-sm text-gray-600">
          {propostas.length} {propostas.length === 1 ? 'proposta' : 'propostas'}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Número</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Grão · quantidade</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Validade</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {propostas.map((p) => {
              const graos = (Array.isArray(p.graos) ? p.graos : []) as GraoItem[]
              const primeiro = graos[0]
              const chip = STATUS_CHIP[p.status] ?? STATUS_CHIP.enviada
              const validadeStr = new Date(p.validadeEm).toLocaleDateString('pt-BR')
              const dias = Math.round(
                (new Date(p.validadeEm).getTime() - Date.now()) / 86_400_000
              )
              const vencendo = dias >= 0 && dias <= 3
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-3 font-mono">{p.numero}</td>
                  <td className="p-3 capitalize">{p.tipo}</td>
                  <td className="p-3">
                    {primeiro?.grao ? (
                      <>
                        <span className="capitalize">{primeiro.grao}</span>
                        {primeiro.quantidade != null && (
                          <span className="ml-1 text-gray-500">
                            · {Number(primeiro.quantidade).toFixed(2)} t
                          </span>
                        )}
                        {graos.length > 1 && (
                          <span className="ml-1 text-xs text-gray-400">
                            +{graos.length - 1}
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3 tabular-nums">{fmt(Number(p.valorTotal))}</td>
                  <td className="p-3 tabular-nums">
                    {validadeStr}
                    {vencendo && (
                      <span className="ml-2 text-xs font-semibold text-red-600">
                        {dias === 0 ? 'hoje' : `${dias}d`}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: chip.bg, color: chip.fg }}
                    >
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/portal/${params.workspaceSlug}/propostas/${p.id}`}
                      className="text-green-700 hover:underline"
                    >
                      {p.status === 'enviada' ? 'Aceitar / Recusar' : 'Ver'}
                    </Link>
                  </td>
                </tr>
              )
            })}
            {propostas.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  Você ainda não tem propostas para visualizar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
