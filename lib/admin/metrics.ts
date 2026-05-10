/**
 * Métricas operacionais e financeiras para o dashboard super admin.
 *
 * Todas as queries são GLOBAIS (não filtradas por workspace) — destinadas
 * apenas a usuários com role='admin'.
 *
 * Performance: projetado pra rodar em < 2s. Queries pesadas (top workspaces)
 * limitam scope a últimos 90d.
 */
import { db } from '@/lib/db'
import { loadPlanMaps, type PlanMaps } from '@/lib/pricing/maps'

export interface MrrTrendPoint {
  month: string // 'YYYY-MM'
  label: string // 'mai', 'jun'
  value: number // R$ inteiros (não cents)
}

export interface PlanDistribution {
  plan: string
  label: string
  count: number
  mrr: number // R$ contribuído
  pctMrr: number // 0-100
}

export interface TopWorkspace {
  id: string
  name: string
  plano: string | null
  status: string | null
  propostas30d: number
  contratos30d: number
  membros: number
  criadoEm: string
}

export interface DashboardMetrics {
  // Receita
  mrr: number // R$ recorrente mensal (inteiros)
  mrrCents: number // raw cents
  mrrTrend: MrrTrendPoint[] // últimos 6 meses

  // Clientes
  totalWorkspaces: number
  workspacesAtivos: number
  workspacesTrial: number
  workspacesPaused: number // past_due | unpaid | canceled
  workspacesSemAssinatura: number

  // Conversão
  signupsUltimos30d: number
  trialParaPagoConversao: number // % nos últimos 90d
  trialIniciados90d: number
  trialConvertidos90d: number

  // Engagement
  workspacesAtivosUltimos7d: number

  // Distribuição por plano
  porPlano: PlanDistribution[]

  // Top workspaces
  topWorkspaces: TopWorkspace[]

  // Churn
  churnUltimo30d: number

  // Hedge & Risco (Epic 4) — vitrine pra plano Enterprise
  volumeHedgeAtivoUSD: number // soma do notional USD de PosicaoHedge abertas
  exposicaoCambialMedianaUSD: number // mediana do |exposição líquida USD| por workspace

  geradoEm: string
}

interface MonthBucket {
  ym: string
  label: string
  start: Date
  end: Date
}

function lastNMonths(n: number): MonthBucket[] {
  const now = new Date()
  const buckets: MonthBucket[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'short' })
    buckets.push({ ym, label, start, end })
  }
  return buckets
}

function mrrCentsForSubscription(
  sub: { plan: string; extraSeatsCount?: number | null },
  maps: PlanMaps,
  extraSeatPriceMap: Record<string, number>,
): number {
  const base = maps.priceCents[sub.plan] ?? 0
  const extras = sub.extraSeatsCount ?? 0
  const extraPrice = extraSeatPriceMap[sub.plan] ?? 0
  return base + extras * extraPrice
}

export async function calcularMetricas(): Promise<DashboardMetrics> {
  const now = new Date()
  const nowMs = now.getTime()
  const last7d = new Date(nowMs - 7 * 24 * 3600 * 1000)
  const last30d = new Date(nowMs - 30 * 24 * 3600 * 1000)
  const last90d = new Date(nowMs - 90 * 24 * 3600 * 1000)

  const months6 = lastNMonths(6)

  // Carrega plan maps + preços extras de seat por slug
  const [maps, plansRaw] = await Promise.all([
    loadPlanMaps(),
    db.plan.findMany({
      select: { slug: true, extraMemberPriceCents: true, includedMembers: true },
    }),
  ])
  const extraSeatPriceMap: Record<string, number> = {}
  for (const p of plansRaw) {
    extraSeatPriceMap[p.slug] = p.extraMemberPriceCents ?? 0
  }

  const [
    allSubs,
    workspacesTotal,
    signups30d,
    propostas7d,
    contratos7d,
    boletos7d,
    activeMembersByWs,
  ] = await Promise.all([
    db.subscription.findMany({
      select: {
        id: true,
        workspaceId: true,
        plan: true,
        status: true,
        memberCount: true,
        extraSeatsCount: true,
        trialStart: true,
        trialEnd: true,
        createdAt: true,
        canceledAt: true,
        updatedAt: true,
      },
    }),
    db.workspace.count(),
    db.user.count({ where: { criadoEm: { gte: last30d } } }),
    db.proposta.findMany({
      where: { criadaEm: { gte: last7d } },
      select: { workspaceId: true },
    }),
    db.contrato.findMany({
      where: { criadoEm: { gte: last7d } },
      select: { workspaceId: true },
    }),
    db.boleto.findMany({
      where: { criadoEm: { gte: last7d } },
      select: { workspaceId: true },
    }),
    db.workspaceMember.groupBy({
      by: ['workspaceId'],
      where: { status: 'active' },
      _count: { _all: true },
    }),
  ])

  // ---------- MRR ----------
  const activeSubs = allSubs.filter((s) => s.status === 'active')
  const mrrCents = activeSubs.reduce(
    (acc, s) => acc + mrrCentsForSubscription(s, maps, extraSeatPriceMap),
    0,
  )

  // MRR trend: para cada mês, considera subs que estavam "active-equivalent"
  // antes do fim do mês (createdAt < end e (canceledAt nulo ou >= end))
  // Snapshot baseado em estado atual + canceledAt — não tabela histórica.
  const mrrTrend: MrrTrendPoint[] = months6.map((m) => {
    const subsActiveAtEnd = allSubs.filter(
      (s) =>
        s.createdAt < m.end &&
        (s.status === 'active' ||
          s.status === 'past_due' ||
          (s.canceledAt && s.canceledAt >= m.end)),
    )
    const cents = subsActiveAtEnd.reduce(
      (acc, s) => acc + mrrCentsForSubscription(s, maps, extraSeatPriceMap),
      0,
    )
    return { month: m.ym, label: m.label, value: Math.round(cents / 100) }
  })

  // ---------- Status counts ----------
  let workspacesAtivos = 0
  let workspacesTrial = 0
  let workspacesPaused = 0
  for (const s of allSubs) {
    if (s.status === 'active') workspacesAtivos++
    else if (s.status === 'trialing') workspacesTrial++
    else if (
      s.status === 'past_due' ||
      s.status === 'unpaid' ||
      s.status === 'canceled' ||
      s.status === 'incomplete_expired'
    )
      workspacesPaused++
  }
  const workspacesSemAssinatura = Math.max(0, workspacesTotal - allSubs.length)

  // ---------- Conversão trial→paid (últimos 90d) ----------
  // Trials iniciados nos últimos 90d: subscription criada no período cujo
  // status passou por trialing (assumimos que toda sub começa como trialing).
  const trialIniciados90d = allSubs.filter(
    (s) => s.createdAt >= last90d,
  ).length
  const trialConvertidos90d = allSubs.filter(
    (s) => s.createdAt >= last90d && s.status === 'active',
  ).length
  const trialParaPagoConversao =
    trialIniciados90d > 0
      ? Math.round((trialConvertidos90d / trialIniciados90d) * 1000) / 10
      : 0

  // ---------- Engagement (últimos 7d) ----------
  const wsActiveSet = new Set<string>()
  for (const p of propostas7d) wsActiveSet.add(p.workspaceId)
  for (const c of contratos7d) wsActiveSet.add(c.workspaceId)
  for (const b of boletos7d) wsActiveSet.add(b.workspaceId)
  const workspacesAtivosUltimos7d = wsActiveSet.size

  // ---------- Distribuição por plano ----------
  const porPlanoMap = new Map<
    string,
    { count: number; mrrCents: number }
  >()
  for (const s of activeSubs) {
    const cur = porPlanoMap.get(s.plan) ?? { count: 0, mrrCents: 0 }
    cur.count += 1
    cur.mrrCents += mrrCentsForSubscription(s, maps, extraSeatPriceMap)
    porPlanoMap.set(s.plan, cur)
  }
  const porPlano: PlanDistribution[] = Array.from(porPlanoMap.entries())
    .map(([plan, v]) => ({
      plan,
      label: maps.label[plan] ?? plan,
      count: v.count,
      mrr: Math.round(v.mrrCents / 100),
      pctMrr:
        mrrCents > 0
          ? Math.round((v.mrrCents / mrrCents) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.mrr - a.mrr)

  // ---------- Churn (últimos 30d) ----------
  const churnUltimo30d = allSubs.filter(
    (s) =>
      s.canceledAt &&
      s.canceledAt >= last30d &&
      (s.status === 'canceled' ||
        s.status === 'unpaid' ||
        s.status === 'incomplete_expired'),
  ).length

  // ---------- Top workspaces (top 10 por uso 30d) ----------
  // 1. Conta propostas/contratos por workspaceId nos últimos 30d
  // 2. Pega top 30 candidatos por sum(propostas+contratos*2)
  // 3. Hidrata com workspace + subscription + memberCount
  const [propostas30dRaw, contratos30dRaw] = await Promise.all([
    db.proposta.groupBy({
      by: ['workspaceId'],
      where: { criadaEm: { gte: last30d } },
      _count: { _all: true },
    }),
    db.contrato.groupBy({
      by: ['workspaceId'],
      where: { criadoEm: { gte: last30d } },
      _count: { _all: true },
    }),
  ])

  const usoByWs = new Map<
    string,
    { propostas: number; contratos: number; score: number }
  >()
  for (const p of propostas30dRaw) {
    const cur = usoByWs.get(p.workspaceId) ?? {
      propostas: 0,
      contratos: 0,
      score: 0,
    }
    cur.propostas = p._count._all
    cur.score += p._count._all
    usoByWs.set(p.workspaceId, cur)
  }
  for (const c of contratos30dRaw) {
    const cur = usoByWs.get(c.workspaceId) ?? {
      propostas: 0,
      contratos: 0,
      score: 0,
    }
    cur.contratos = c._count._all
    cur.score += c._count._all * 2
    usoByWs.set(c.workspaceId, cur)
  }

  const topCandidates = Array.from(usoByWs.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 10)
    .map(([id, v]) => ({ id, ...v }))

  let topWorkspaces: TopWorkspace[] = []
  if (topCandidates.length > 0) {
    const ids = topCandidates.map((c) => c.id)
    const wsList = await db.workspace.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        createdAt: true,
        subscription: { select: { plan: true, status: true } },
      },
    })
    const wsById = new Map(wsList.map((w) => [w.id, w]))
    const memberCountByWs = new Map<string, number>()
    for (const m of activeMembersByWs) {
      memberCountByWs.set(m.workspaceId, m._count._all)
    }
    topWorkspaces = topCandidates
      .map((c) => {
        const ws = wsById.get(c.id)
        if (!ws) return null
        return {
          id: ws.id,
          name: ws.name,
          plano: ws.subscription?.plan ?? null,
          status: ws.subscription?.status ?? null,
          propostas30d: c.propostas,
          contratos30d: c.contratos,
          membros: memberCountByWs.get(ws.id) ?? 0,
          criadoEm: ws.createdAt.toISOString(),
        } as TopWorkspace
      })
      .filter((x): x is TopWorkspace => x !== null)
  }

  // === Hedge & Risco (Epic 4) ===
  // Volume hedge ativo (soma USD de PosicaoHedge abertas em todos workspaces)
  let volumeHedgeAtivoUSD = 0
  let exposicaoCambialMedianaUSD = 0
  try {
    const posicoesAbertas = await db.posicaoHedge.findMany({
      where: { status: 'aberta' },
      select: {
        workspaceId: true,
        qtdContratos: true,
        precoEntradaUsdBu: true,
      },
    })
    for (const p of posicoesAbertas) {
      volumeHedgeAtivoUSD +=
        Number(p.qtdContratos) * 5000 * Number(p.precoEntradaUsdBu ?? 0)
    }

    // Exposição cambial mediana — agrega por workspace (somente magnitude)
    const porWs = new Map<string, number>()
    for (const p of posicoesAbertas) {
      const v =
        Number(p.qtdContratos) * 5000 * Number(p.precoEntradaUsdBu ?? 0)
      porWs.set(p.workspaceId, (porWs.get(p.workspaceId) ?? 0) + v)
    }
    const valores = Array.from(porWs.values())
      .map((v) => Math.abs(v))
      .sort((a, b) => a - b)
    if (valores.length > 0) {
      const mid = Math.floor(valores.length / 2)
      exposicaoCambialMedianaUSD =
        valores.length % 2 === 0
          ? (valores[mid - 1] + valores[mid]) / 2
          : valores[mid]
    }
  } catch (err) {
    // Se tabela nova ainda não existir (pré-migration), zero é OK.
  }

  return {
    mrr: Math.round(mrrCents / 100),
    mrrCents,
    mrrTrend,
    totalWorkspaces: workspacesTotal,
    workspacesAtivos,
    workspacesTrial,
    workspacesPaused,
    workspacesSemAssinatura,
    signupsUltimos30d: signups30d,
    trialParaPagoConversao,
    trialIniciados90d,
    trialConvertidos90d,
    workspacesAtivosUltimos7d,
    porPlano,
    topWorkspaces,
    churnUltimo30d,
    volumeHedgeAtivoUSD,
    exposicaoCambialMedianaUSD,
    geradoEm: new Date().toISOString(),
  }
}
