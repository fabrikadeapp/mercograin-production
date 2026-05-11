import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Shield, TrendingUp, Globe2, Wallet, AlertCircle } from 'lucide-react'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { VgAppShell, VgPageHeader } from '@/components/ui/visionglass'
import { calcularExposicao } from '@/lib/hedge/exposicao'

export const dynamic = 'force-dynamic'

function fmtUSD(n: number): string {
  return `US$ ${Math.round(n).toLocaleString('pt-BR')}`
}
function fmtBRL(n: number): string {
  return `R$ ${Math.round(n).toLocaleString('pt-BR')}`
}

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const hoje = new Date()
  const ontem = new Date(hoje.getTime() - 24 * 86400_000)

  const [posicoesAbertas, ndfsAtivos, marcacoesHoje, contratos, posicoes, ndfsCambial, taxa] =
    await Promise.all([
      db.posicaoHedge.count({ where: { ...scope.whereOwn(), status: 'aberta' } }),
      db.nDF.count({ where: { ...scope.whereOwn(), status: 'aberta' } }),
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
      db.posicaoHedge.findMany({ where: { ...scope.whereOwn(), status: 'aberta' } }),
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
    0,
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
    hoje,
  )

  const pnlClass =
    pnlDiaBRL === 0
      ? 'text-vg-fg-2'
      : pnlDiaBRL > 0
        ? 'text-vg-success'
        : 'text-vg-destructive'

  return (
    <VgAppShell>
      <VgPageHeader
        eyebrow="Operações · Hedge & Risco"
        title="Hedge & Risco"
        subtitle="Long/Short, marcação a mercado, NDF e exposição cambial — controle profissional de risco da sua corretora."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="vg-card">
          <div className="text-vg-caption text-vg-fg-3 mb-2">Posições abertas</div>
          <div className="vg-metric tabular-nums">{posicoesAbertas}</div>
        </div>
        <div className="vg-card">
          <div className="text-vg-caption text-vg-fg-3 mb-2">P&amp;L do dia</div>
          <div className={`vg-metric tabular-nums ${pnlClass}`}>{fmtBRL(pnlDiaBRL)}</div>
        </div>
        <div className="vg-card">
          <div className="text-vg-caption text-vg-fg-3 mb-2">Exposição USD</div>
          <div className="vg-metric tabular-nums">
            {fmtUSD(Math.max(0, exposicao.exposicaoLiquidaUSD))}
          </div>
          <div className="text-vg-caption text-vg-fg-3 mt-1">
            {(exposicao.hedgeRatio * 100).toFixed(0)}% coberto
          </div>
          {exposicao.alertaSubExposto ? (
            <div
              className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{
                background: 'var(--vg-accent-destructive-muted)',
                color: 'var(--vg-accent-destructive)',
              }}
            >
              <AlertCircle className="w-3 h-3" /> Sub-exposto
            </div>
          ) : null}
        </div>
        <div className="vg-card">
          <div className="text-vg-caption text-vg-fg-3 mb-2">NDF ativos</div>
          <div className="vg-metric tabular-nums">{ndfsAtivos}</div>
        </div>
      </div>

      {/* Subsections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/hedge/posicoes" className="vg-card vg-card--interactive block">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-5 h-5 text-vg-accent" />
            <span className="text-vg-h3">Posições</span>
          </div>
          <p className="text-vg-label text-vg-fg-2">Abrir, fechar e marcar a mercado.</p>
        </Link>
        <Link href="/hedge/long-short" className="vg-card vg-card--interactive block">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-vg-accent" />
            <span className="text-vg-h3">Long × Short</span>
          </div>
          <p className="text-vg-label text-vg-fg-2">Net por cultura.</p>
        </Link>
        <Link href="/hedge/exposicao" className="vg-card vg-card--interactive block">
          <div className="flex items-center gap-3 mb-2">
            <Globe2 className="w-5 h-5 text-vg-accent" />
            <span className="text-vg-h3">Exposição cambial</span>
          </div>
          <p className="text-vg-label text-vg-fg-2">Hedge ratio + alertas.</p>
        </Link>
        <Link href="/hedge/ndf" className="vg-card vg-card--interactive block">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-5 h-5 text-vg-accent" />
            <span className="text-vg-h3">NDF</span>
          </div>
          <p className="text-vg-label text-vg-fg-2">Forwards de moeda e commodity.</p>
        </Link>
      </div>
    </VgAppShell>
  )
}
