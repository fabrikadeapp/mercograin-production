import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, Chip } from '@/components/ui/phb'
import { LoteActions } from './_components/LoteActions'

export const dynamic = 'force-dynamic'

const TIPO_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  transferencia: 'Transferência',
  quebra_tecnica: 'Quebra técnica',
  rebaixe: 'Rebaixe',
}

export default async function LoteDetalhePage({
  params,
}: {
  params: { loteId: string }
}) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const lote = await db.loteEstoque.findFirst({
    where: { id: params.loteId, ...scope.whereOwn() },
    include: {
      armazem: { select: { id: true, nome: true } },
      safra: { select: { id: true, nome: true } },
      movimentacoes: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!lote) notFound()

  const armazens = await db.armazem.findMany({
    where: { ...scope.whereOwn(), ativo: true, id: { not: lote.armazemId } },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Lote · ${lote.numero}`}
        title={`${lote.cultura} em ${lote.armazem.nome}`}
        subtitle={`Saldo atual: ${lote.qtdAtualSc.toLocaleString('pt-BR')} sc / ${lote.qtdInicialSc.toLocaleString('pt-BR')} inicial`}
        actions={<LoteActions loteId={lote.id} saldoAtual={lote.qtdAtualSc} armazens={armazens} />}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="eyebrow mb-1">Status</p>
          <Chip variant={lote.status === 'ativo' ? 'pos' : 'neutral'}>{lote.status}</Chip>
        </Card>
        <Card>
          <p className="eyebrow mb-1">Umidade média</p>
          <p>{lote.umidadeMedia ? `${lote.umidadeMedia.toFixed(2)}%` : '—'}</p>
        </Card>
        <Card>
          <p className="eyebrow mb-1">Impureza média</p>
          <p>{lote.impurezaMedia ? `${lote.impurezaMedia.toFixed(2)}%` : '—'}</p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="font-semibold">Histórico de movimentações</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/40 text-left text-zinc-400">
            <tr>
              <th className="p-3">Data</th>
              <th className="p-3">Tipo</th>
              <th className="p-3 text-right">Qtd (sc)</th>
              <th className="p-3">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {lote.movimentacoes.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-zinc-500">
                  Sem movimentações.
                </td>
              </tr>
            ) : (
              lote.movimentacoes.map((m) => (
                <tr key={m.id} className="border-t border-zinc-800">
                  <td className="p-3">
                    {new Date(m.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="p-3">
                    <Chip
                      variant={
                        m.tipo === 'entrada' ? 'pos' : m.tipo === 'rebaixe' ? 'warn' : 'neg'
                      }
                    >
                      {TIPO_LABEL[m.tipo] || m.tipo}
                    </Chip>
                  </td>
                  <td className="p-3 text-right font-mono">
                    {m.tipo === 'entrada' ? '+' : '−'}
                    {m.qtdSc.toLocaleString('pt-BR')}
                  </td>
                  <td className="p-3 text-zinc-400">{m.motivo || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  )
}
