import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, KPICard } from '@/components/ui/phb'
import { Shield, TrendingUp, Globe2, Wallet } from 'lucide-react'
import { calcularExposicao } from '@/lib/hedge/exposicao'

export const dynamic = 'force-dynamic'

function fmtUSD(n: number): string {
  return `US$ ${Math.round(n).toLocaleString('pt-BR')}`
}
function fmtBRL(n: number): string {
  return `R$ ${Math.round(n).toLocaleString('pt-BR')}`
}

export default async function HedgeHubPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const hoje = new Date()
  const ontem = new Date(hoje.getTime() - 24 * 86400_000)

  const [posicoesAbertas, ndfsAtivos, marcacoesHoje, contratos, posicoes, ndfsCambial, taxa] =
    await Promise.all([
      db.posicaoHedge.count({
        where: { ...scope.whereOwn(), status: 'aberta' },
      }),
      db.nDF.count({
        where: { ...scope.whereOwn(), status: 'aberta' },
      }),
      db.marcacaoMercado.findMany({
        where: { ...scope.whereOwn(), data: { gte: ontem } },
        orderBy: { data: 'desc' },
        take: 200,
      }),
      db.contrato.findMany({
        where: {
          ...scope.whereOwn(),
          OR: [{ dataFim: null }, { dataFim: { gte: hoje } }],
        },
        include: { proposta: { select: { valorTotal: true } } },
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

  const pnlDiaBRL = marcacoesHoje.reduce(
    (sum, m) => sum + Number(m.variacaoDiaBRL ?? 0),
    0
  )

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
    ndfsCambial.map((n) => ({
      notionalUSD: Number(n.notional),
      direcao: n.direcao as 'compra' | 'venda',
    })),
    hoje
  )

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operações · Hedge & Risco"
        title="Hedge & Risco"
        subtitle="Long/Short, marcação a mercado, NDF e exposição cambial — controle profissional de risco da sua corretora."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard eyebrow="Posições abertas" value={String(posicoesAbertas)} />
        <KPICard
          eyebrow="P&L do dia"
          value={fmtBRL(pnlDiaBRL)}
          delta={
            pnlDiaBRL === 0
              ? undefined
              : {
                  value: pnlDiaBRL > 0 ? '+ ganho' : '- perda',
                  trend: pnlDiaBRL > 0 ? 'pos' : 'neg',
                }
          }
        />
        <Card className="p-5 space-y-3">
          <p className="eyebrow">Exposição USD</p>
          <p className="t-num-lg text-fg-1">
            {fmtUSD(Math.max(0, exposicao.exposicaoLiquidaUSD))}
          </p>
          <p className="text-small text-fg-3">
            {(exposicao.hedgeRatio * 100).toFixed(0)}% coberto
          </p>
          {exposicao.alertaSubExposto && (
            <span
              className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-micro font-medium"
              style={{
                background: 'rgba(211, 47, 47, 0.10)',
                color: 'var(--neg)',
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-pill"
                style={{ background: 'var(--neg)' }}
                aria-hidden
              />
              Sub-exposto
            </span>
          )}
        </Card>
        <KPICard eyebrow="NDF ativos" value={String(ndfsAtivos)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/hedge/posicoes" className="block">
          <Card className="h-full p-5 hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-5 w-5 text-emerald-400" />
              <span className="t-num-sm">Posições</span>
            </div>
            <p className="text-fg-3 text-small">Abrir, fechar e marcar a mercado.</p>
          </Card>
        </Link>
        <Link href="/hedge/long-short" className="block">
          <Card className="h-full p-5 hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <span className="t-num-sm">Long × Short</span>
            </div>
            <p className="text-fg-3 text-small">Net por cultura.</p>
          </Card>
        </Link>
        <Link href="/hedge/exposicao" className="block">
          <Card className="h-full p-5 hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <Globe2 className="h-5 w-5 text-emerald-400" />
              <span className="t-num-sm">Exposição cambial</span>
            </div>
            <p className="text-fg-3 text-small">Hedge ratio + alertas.</p>
          </Card>
        </Link>
        <Link href="/hedge/ndf" className="block">
          <Card className="h-full p-5 hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <Wallet className="h-5 w-5 text-emerald-400" />
              <span className="t-num-sm">NDF</span>
            </div>
            <p className="text-fg-3 text-small">Forwards de moeda e commodity.</p>
          </Card>
        </Link>
      </div>
    </AppShell>
  )
}
