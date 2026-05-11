/**
 * lib/bi/clevel.ts
 * KPIs C-Level reais para painel executivo.
 *
 * Convenções:
 *  - 1 saca = 60 kg (0.06 t)
 *  - Volume entregue = TicketBalanca.pesoLiquidoKg / 1000 (toneladas)
 *  - Volume contratado = Σ (Proposta.graos[].quantidade ou quantidadeSc) × 0.06
 *  - Receita comissão = Σ ComissaoApurada.valorTotalComissao (status != 'cancelada')
 *  - Despesas op. = Σ MovimentoFinanceiro (tipo='despesa', período)
 *  - EBITDA = Receita - Despesas (proxy contábil; juros/impostos/depreciação ignorados)
 *  - ROIC proxy = EBITDA / (aging_recebiveis + 1) — capital de giro aproximado pelo valor a receber em aberto
 *  - Share regional = % contratos por UF do destino (Oferta.destino quando existe; senão UF do cliente)
 *  - Sinistralidade = valor com quebra (MovimentacaoLote tipo='quebra_tecnica'|'rebaixe') / volume entregue
 */
import { db } from '@/lib/db'

export interface PeriodoBI {
  inicio: Date
  fim: Date
}

export interface KpisCLevel {
  volumeTotalToneladas: number
  ebitda: number
  ebitdaMargem: number
  roic: number
  shareRegional: Record<string, number>
  comissaoTotal: number
  ticketMedio: number
  taxaSinistralidade: number
  receitaTotal: number
  despesaTotal: number
  contratosAtivos: number
  periodo: { inicio: string; fim: string }
}

function defaultPeriodo(): PeriodoBI {
  const fim = new Date()
  const inicio = new Date(fim.getFullYear(), 0, 1)
  return { inicio, fim }
}

function ufFromEndereco(endereco?: string | null): string | null {
  if (!endereco) return null
  const m = endereco.match(/\b([A-Z]{2})\b/)
  return m ? m[1] : null
}

export async function kpisCLevel(
  workspaceId: string,
  periodo?: PeriodoBI
): Promise<KpisCLevel> {
  const p = periodo || defaultPeriodo()

  const [
    propostasAceitas,
    tickets,
    comissoes,
    despesas,
    contratos,
    boletosAbertos,
    quebras,
  ] = await Promise.all([
    db.proposta.findMany({
      where: {
        workspaceId,
        status: 'aceita',
        criadaEm: { gte: p.inicio, lte: p.fim },
      },
      select: {
        graos: true,
        valorTotal: true,
        cliente: { select: { endereco: true } },
      },
    }),
    db.ticketBalanca.findMany({
      where: {
        workspaceId,
        status: 'finalizado',
        createdAt: { gte: p.inicio, lte: p.fim },
      },
      select: { pesoLiquidoKg: true },
    }),
    db.comissaoApurada.findMany({
      where: {
        workspaceId,
        status: { not: 'cancelada' },
        createdAt: { gte: p.inicio, lte: p.fim },
      },
      select: { valorTotalComissao: true, valorContrato: true },
    }),
    db.movimentoFinanceiro.aggregate({
      where: {
        workspaceId,
        tipo: 'despesa',
        data: { gte: p.inicio, lte: p.fim },
      },
      _sum: { valor: true },
    }),
    db.contrato.findMany({
      where: {
        workspaceId,
        criadoEm: { gte: p.inicio, lte: p.fim },
      },
      select: {
        id: true,
        cliente: { select: { endereco: true } },
      },
    }),
    db.boleto.aggregate({
      where: { workspaceId, status: { in: ['aberto', 'vencido'] } },
      _sum: { valor: true },
    }),
    db.movimentacaoLote.findMany({
      where: {
        workspaceId,
        tipo: { in: ['quebra_tecnica', 'rebaixe'] },
        createdAt: { gte: p.inicio, lte: p.fim },
      },
      select: { qtdSc: true },
    }),
  ])

  // Volume contratado (toneladas) — Σ sacas × 0.06
  let sacasContratadas = 0
  for (const prop of propostasAceitas) {
    const arr = Array.isArray(prop.graos) ? (prop.graos as any[]) : []
    for (const g of arr) {
      const qtd = Number(g?.quantidadeSc ?? g?.quantidade ?? 0)
      sacasContratadas += qtd
    }
  }
  const volumeContratadoT = sacasContratadas * 0.06

  // Volume entregue (toneladas)
  const volumeEntregueT =
    tickets.reduce((s, t) => s + Number(t.pesoLiquidoKg || 0), 0) / 1000

  const volumeTotalToneladas = volumeContratadoT + volumeEntregueT

  // Receita comissão
  const comissaoTotal = comissoes.reduce(
    (s, c) => s + Number(c.valorTotalComissao),
    0
  )
  const valorContratos = comissoes.reduce(
    (s, c) => s + Number(c.valorContrato),
    0
  )
  const despesaTotal = Number(despesas._sum.valor || 0)
  const receitaTotal = comissaoTotal
  const ebitda = receitaTotal - despesaTotal
  const ebitdaMargem = receitaTotal > 0 ? (ebitda / receitaTotal) * 100 : 0

  // ROIC proxy
  const capitalGiro = Number(boletosAbertos._sum.valor || 0)
  const roic =
    capitalGiro > 0 ? (ebitda / capitalGiro) * 100 : ebitda > 0 ? 100 : 0

  // Share regional (% contratos por UF)
  const ufAcc: Record<string, number> = {}
  for (const c of contratos) {
    const uf = ufFromEndereco(c.cliente?.endereco)
    if (uf) ufAcc[uf] = (ufAcc[uf] || 0) + 1
  }
  const totalUf = Object.values(ufAcc).reduce((s, n) => s + n, 0) || 1
  const shareRegional: Record<string, number> = {}
  for (const [uf, n] of Object.entries(ufAcc)) {
    shareRegional[uf] = Math.round((n / totalUf) * 1000) / 10
  }

  // Ticket médio (contrato)
  const ticketMedio = comissoes.length > 0 ? valorContratos / comissoes.length : 0

  // Sinistralidade — sacas quebra/rebaixe sobre sacas entregues
  const sacasQuebra = quebras.reduce((s, q) => s + Number(q.qtdSc || 0), 0)
  const sacasEntregues = volumeEntregueT / 0.06
  const taxaSinistralidade =
    sacasEntregues > 0 ? (sacasQuebra / sacasEntregues) * 100 : 0

  return {
    volumeTotalToneladas: Math.round(volumeTotalToneladas * 100) / 100,
    ebitda: Math.round(ebitda * 100) / 100,
    ebitdaMargem: Math.round(ebitdaMargem * 100) / 100,
    roic: Math.round(roic * 100) / 100,
    shareRegional,
    comissaoTotal: Math.round(comissaoTotal * 100) / 100,
    ticketMedio: Math.round(ticketMedio * 100) / 100,
    taxaSinistralidade: Math.round(taxaSinistralidade * 100) / 100,
    receitaTotal: Math.round(receitaTotal * 100) / 100,
    despesaTotal: Math.round(despesaTotal * 100) / 100,
    contratosAtivos: contratos.length,
    periodo: { inicio: p.inicio.toISOString(), fim: p.fim.toISOString() },
  }
}

/** Série mensal de volume (toneladas) para gráfico evolutivo */
export async function volumeMensal(
  workspaceId: string,
  meses = 12
): Promise<{ label: string; toneladas: number }[]> {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (meses - 1), 1)
  const MESES_PT = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ]

  const tickets = await db.ticketBalanca.findMany({
    where: {
      workspaceId,
      status: 'finalizado',
      createdAt: { gte: start },
    },
    select: { pesoLiquidoKg: true, createdAt: true },
  })

  const out: { label: string; toneladas: number }[] = []
  for (let i = 0; i < meses; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const kg = tickets
      .filter((t) => t.createdAt >= d && t.createdAt < next)
      .reduce((s, t) => s + Number(t.pesoLiquidoKg || 0), 0)
    out.push({
      label: `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
      toneladas: Math.round(kg / 10) / 100, // 2 decimais
    })
  }
  return out
}

/** EBITDA mensal */
export async function ebitdaMensal(
  workspaceId: string,
  meses = 12
): Promise<{ label: string; ebitda: number; receita: number; despesa: number }[]> {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (meses - 1), 1)
  const MESES_PT = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ]

  const [comissoes, despesas] = await Promise.all([
    db.comissaoApurada.findMany({
      where: {
        workspaceId,
        status: { not: 'cancelada' },
        createdAt: { gte: start },
      },
      select: { valorTotalComissao: true, createdAt: true },
    }),
    db.movimentoFinanceiro.findMany({
      where: {
        workspaceId,
        tipo: 'despesa',
        data: { gte: start },
      },
      select: { valor: true, data: true },
    }),
  ])

  const out: { label: string; ebitda: number; receita: number; despesa: number }[] = []
  for (let i = 0; i < meses; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const rec = comissoes
      .filter((c) => c.createdAt >= d && c.createdAt < next)
      .reduce((s, c) => s + Number(c.valorTotalComissao), 0)
    const desp = despesas
      .filter((m) => m.data >= d && m.data < next)
      .reduce((s, m) => s + Number(m.valor), 0)
    out.push({
      label: `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
      receita: Math.round(rec * 100) / 100,
      despesa: Math.round(desp * 100) / 100,
      ebitda: Math.round((rec - desp) * 100) / 100,
    })
  }
  return out
}
