import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, KPICard, Chip } from '@/components/ui/phb'
import { calcularExposicao } from '@/lib/hedge/exposicao'

export const dynamic = 'force-dynamic'

function fmtUSD(n: number): string {
  return `US$ ${Math.round(n).toLocaleString('pt-BR')}`
}

export default async function ExposicaoPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const hoje = new Date()

  const [contratos, posicoes, ndfs, taxa] = await Promise.all([
    db.contrato.findMany({
      where: {
        ...scope.whereOwn(),
        OR: [{ dataFim: null }, { dataFim: { gte: hoje } }],
      },
      include: {
        proposta: { select: { valorTotal: true } },
        cliente: { select: { nome: true } },
      },
      orderBy: { dataFim: 'asc' },
    }),
    db.posicaoHedge.findMany({
      where: { ...scope.whereOwn(), status: 'aberta' },
    }),
    db.nDF.findMany({
      where: { ...scope.whereOwn(), status: 'aberta', tipo: 'moeda', direcao: 'venda' },
    }),
    db.taxaCambio.findFirst({
      where: { origem: 'USD', destino: 'BRL' },
      orderBy: { data: 'desc' },
    }),
  ])

  const cambio = taxa ? Number(taxa.taxa) : 5.0

  const exposicao = calcularExposicao(
    contratos.map((c) => ({
      valorTotalUSD: Number(c.proposta?.valorTotal ?? 0) / cambio,
      vencimento: c.dataFim ?? new Date(hoje.getTime() + 90 * 86400_000),
    })),
    posicoes.map((p) => ({
      qtdContratosUSD:
        Number(p.qtdContratos) * 5000 * Number(p.precoEntradaUsdBu ?? 0),
      tipo: p.tipo as 'long' | 'short',
    })),
    ndfs.map((n) => ({
      notionalUSD: Number(n.notional),
      direcao: n.direcao as 'compra' | 'venda',
    })),
    hoje
  )

  // Contratos sem hedge associado (sugestão de cobertura)
  const contratoIdsComHedge = new Set(
    posicoes.map((p) => p.contratoOrigemId).filter(Boolean) as string[]
  )
  const semHedge = contratos.filter((c) => !contratoIdsComHedge.has(c.id))

  return (
    <AppShell>
      <PageHeader
        eyebrow="Hedge"
        title="Exposição cambial"
        subtitle="Hedge ratio, cobertura via posições e NDFs, alertas de sub-exposição."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard
          eyebrow="Contratos USD"
          value={fmtUSD(exposicao.totalContratosUSD)}
          subtitle={`${contratos.length} contratos pendentes`}
        />
        <KPICard
          eyebrow="Hedge USD"
          value={fmtUSD(exposicao.totalHedgeUSD)}
          subtitle={`${posicoes.length} posições`}
        />
        <KPICard
          eyebrow="NDF cambial"
          value={fmtUSD(exposicao.totalNdfUSD)}
          subtitle={`${ndfs.length} forwards`}
        />
        <KPICard
          eyebrow="Hedge ratio"
          value={`${(exposicao.hedgeRatio * 100).toFixed(0)}%`}
          delta={
            exposicao.alertaSubExposto
              ? { value: 'sub-exposto', trend: 'neg' }
              : { value: 'OK', trend: 'pos' }
          }
        />
      </div>

      {exposicao.alertaSubExposto ? (
        <Card className="p-4 mb-4 border-l-4" style={{ borderLeftColor: 'var(--neg)' }}>
          <p className="text-small text-fg-2">
            <span className="text-neg font-medium">Alerta:</span> hedge ratio &lt; 70% com prazo médio &lt; 90 dias.
            Recomenda-se cobrir parte dos contratos via posições short ou NDF de venda USD.
          </p>
        </Card>
      ) : null}

      <Card className="p-0 overflow-hidden mb-4">
        <div className="p-4 border-b border-border-1">
          <p className="eyebrow">Contratos sem hedge associado</p>
          <p className="text-fg-3 text-small">Sugestão de cobertura.</p>
        </div>
        <table className="w-full text-small">
          <thead className="bg-bg-2 text-fg-3">
            <tr>
              <th className="text-left p-3">Contrato</th>
              <th className="text-left p-3">Cliente</th>
              <th className="text-right p-3">Valor (BRL)</th>
              <th className="text-right p-3">Equiv USD</th>
              <th className="text-right p-3">Vencimento</th>
            </tr>
          </thead>
          <tbody>
            {semHedge.slice(0, 30).map((c) => {
              const valorBrl = Number(c.proposta?.valorTotal ?? 0)
              const valorUsd = valorBrl / cambio
              return (
                <tr key={c.id} className="border-t border-border-1">
                  <td className="p-3">{c.numero}</td>
                  <td className="p-3 text-fg-2">{c.cliente?.nome ?? '—'}</td>
                  <td className="p-3 text-right t-num-sm">
                    R$ {valorBrl.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="p-3 text-right t-num-sm">{fmtUSD(valorUsd)}</td>
                  <td className="p-3 text-right text-fg-2">
                    {c.dataFim ? c.dataFim.toISOString().slice(0, 10) : '—'}
                  </td>
                </tr>
              )
            })}
            {semHedge.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-fg-3">
                  Todos contratos com hedge — bom controle.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <p className="text-fg-3 text-small">
        Câmbio referência: <Chip variant="neutral">USD/BRL {cambio.toFixed(4)}</Chip>
        {' · '}
        Prazo médio dos contratos: {Math.round(exposicao.prazoMedioContratosDias)}{' '}
        dias.
      </p>
    </AppShell>
  )
}
