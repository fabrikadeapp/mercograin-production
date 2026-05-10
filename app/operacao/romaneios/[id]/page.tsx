import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, Chip } from '@/components/ui/phb'
import { RomaneioActions } from './_components/RomaneioActions'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  em_transito: 'Em trânsito',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
}

export default async function RomaneioDetalhePage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const r = await db.romaneio.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: {
      motorista: true,
      safra: true,
      ticketsBalanca: {
        orderBy: { createdAt: 'asc' },
        include: { classificacao: true, balanca: { select: { id: true, nome: true } } },
      },
    },
  })
  if (!r) notFound()

  const armazens = await db.armazem.findMany({
    where: { ...scope.whereOwn(), ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })

  const totalKg = r.ticketsBalanca.reduce((a, t) => a + (t.pesoLiquidoKg || 0), 0)

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Romaneio · ${r.numero}`}
        title={`${r.origem} → ${r.destino}`}
        subtitle={`${r.cultura} · ${r.ticketsBalanca.length} ticket(s) · ${(totalKg / 1000).toFixed(2)} t`}
        actions={
          <RomaneioActions
            romaneioId={r.id}
            status={r.status}
            armazens={armazens}
          />
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="eyebrow mb-2">Status</p>
          <Chip variant={r.status === 'recebido' ? 'pos' : r.status === 'cancelado' ? 'neg' : 'neutral'}>
            {STATUS_LABEL[r.status] ?? r.status}
          </Chip>
        </Card>
        <Card>
          <p className="eyebrow mb-2">Motorista</p>
          <p>
            {r.motorista
              ? `${r.motorista.nome}${r.motorista.placa ? ' · ' + r.motorista.placa : ''}`
              : '—'}
          </p>
        </Card>
        <Card>
          <p className="eyebrow mb-2">Datas</p>
          <p className="text-sm">
            <span className="text-fg-3">Saída:</span>{' '}
            {r.dataSaida ? new Date(r.dataSaida).toLocaleString('pt-BR') : '—'}
          </p>
          <p className="text-sm">
            <span className="text-fg-3">Chegada:</span>{' '}
            {r.dataChegada ? new Date(r.dataChegada).toLocaleString('pt-BR') : '—'}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="font-semibold">Tickets de balança</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/40 text-left text-zinc-400">
            <tr>
              <th className="p-3">Número</th>
              <th className="p-3">Bruto (kg)</th>
              <th className="p-3">Tara (kg)</th>
              <th className="p-3">Líquido (kg)</th>
              <th className="p-3">Classificação</th>
              <th className="p-3">Líquido final</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {r.ticketsBalanca.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-zinc-500">
                  Sem tickets — use a tela /operacao/balanca para registrar pesagens.
                </td>
              </tr>
            ) : (
              r.ticketsBalanca.map((t) => (
                <tr key={t.id} className="border-t border-zinc-800">
                  <td className="p-3 font-mono">{t.numero}</td>
                  <td className="p-3">{t.pesoBrutoKg.toLocaleString('pt-BR')}</td>
                  <td className="p-3">{t.taraKg.toLocaleString('pt-BR')}</td>
                  <td className="p-3">{t.pesoLiquidoKg.toLocaleString('pt-BR')}</td>
                  <td className="p-3">
                    {t.classificacao
                      ? `umid ${t.classificacao.umidade}% / impur ${t.classificacao.impureza}% / desc ${t.classificacao.descontoTotalPct}%`
                      : '—'}
                  </td>
                  <td className="p-3">
                    {t.classificacao?.pesoLiquidoFinalKg
                      ? t.classificacao.pesoLiquidoFinalKg.toLocaleString('pt-BR')
                      : t.pesoLiquidoKg.toLocaleString('pt-BR')}
                  </td>
                  <td className="p-3">
                    <Chip
                      variant={t.status === 'finalizado' ? 'pos' : t.status === 'classificado' ? 'info' : 'neutral'}
                    >
                      {t.status}
                    </Chip>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  )
}
