/**
 * Limites de risco — calcula exposição atual e detecta breaches.
 *
 * Severidade:
 *  - aviso:   valorAtual >= valorAviso (default 80% do máximo) e < máximo
 *  - breach:  valorAtual >= valorMaximo
 *  - critico: valorAtual >= 120% do máximo
 */

import { db } from '@/lib/db'

export interface ExposicaoBucket {
  usd: number
  brl: number
  qtdSc?: number
}

export interface ExposicaoAtual {
  total: { usd: number; brl: number }
  porCultura: Record<string, ExposicaoBucket>
  porCorretor: Record<string, ExposicaoBucket>
  porContraparte: Record<string, ExposicaoBucket>
  porRegiao: Record<string, ExposicaoBucket>
  porMesa: Record<string, ExposicaoBucket>
  cambioAtual: number
}

const BUSHELS_POR_CONTRATO = 5000

export async function calcularExposicaoAtual(
  workspaceId: string,
): Promise<ExposicaoAtual> {
  // Câmbio atual
  const tx = await db.taxaCambio.findFirst({
    where: { origem: 'USD', destino: 'BRL' },
    orderBy: { data: 'desc' },
  })
  const cambio = tx ? Number(tx.taxa) : 5.0

  // Posições hedge abertas
  const posicoes = await db.posicaoHedge.findMany({
    where: { workspaceId, status: 'aberta' },
  })

  const total = { usd: 0, brl: 0 }
  const porCultura: Record<string, ExposicaoBucket> = {}
  const porCorretor: Record<string, ExposicaoBucket> = {}
  const porMesa: Record<string, ExposicaoBucket> = {}

  for (const p of posicoes) {
    const preco = p.precoEntradaUsdBu ? Number(p.precoEntradaUsdBu) : 0
    const notionalUSD = preco * Number(p.qtdContratos) * BUSHELS_POR_CONTRATO
    const notionalBRL = notionalUSD * cambio
    total.usd += notionalUSD
    total.brl += notionalBRL

    const cult = p.cultura || 'outros'
    if (!porCultura[cult]) porCultura[cult] = { usd: 0, brl: 0, qtdSc: 0 }
    porCultura[cult].usd += notionalUSD
    porCultura[cult].brl += notionalBRL
    porCultura[cult].qtdSc = (porCultura[cult].qtdSc || 0) + Number(p.qtdEquivalenteSc || 0)

    if (p.corretorId) {
      if (!porCorretor[p.corretorId]) porCorretor[p.corretorId] = { usd: 0, brl: 0 }
      porCorretor[p.corretorId].usd += notionalUSD
      porCorretor[p.corretorId].brl += notionalBRL
    }
    if (p.mesaId) {
      if (!porMesa[p.mesaId]) porMesa[p.mesaId] = { usd: 0, brl: 0 }
      porMesa[p.mesaId].usd += notionalUSD
      porMesa[p.mesaId].brl += notionalBRL
    }
  }

  // Contratos físicos por contraparte (cliente) e região (uf)
  const porContraparte: Record<string, ExposicaoBucket> = {}
  const porRegiao: Record<string, ExposicaoBucket> = {}
  const contratos = await db.contrato.findMany({
    where: { workspaceId },
    include: {
      proposta: { select: { valorTotal: true } },
      cliente: { select: { id: true, nome: true, endereco: true } },
    },
  })
  for (const c of contratos) {
    const valor = Number((c as any).proposta?.valorTotal ?? 0)
    if (!valor) continue
    const chaveC = c.cliente?.nome || c.clienteId
    if (!porContraparte[chaveC]) porContraparte[chaveC] = { usd: 0, brl: 0 }
    porContraparte[chaveC].brl += valor
    porContraparte[chaveC].usd += valor / cambio

    // Tenta extrair UF do endereço (formato livre)
    const endereco = (c.cliente as any)?.endereco || ''
    const ufMatch = String(endereco).match(/\b([A-Z]{2})\b\s*$/)
    const uf = ufMatch ? ufMatch[1] : 'XX'
    if (!porRegiao[uf]) porRegiao[uf] = { usd: 0, brl: 0 }
    porRegiao[uf].brl += valor
    porRegiao[uf].usd += valor / cambio
  }

  return { total, porCultura, porCorretor, porContraparte, porRegiao, porMesa, cambioAtual: cambio }
}

export interface BreachCandidato {
  limiteId: string
  escopo: string
  tipo: string
  escopoFiltro: any
  valorAtual: number
  valorMaximo: number
  valorAviso: number
  excedidoEm: number // % acima do máximo (pode ser negativo se ainda em aviso)
  severidade: 'aviso' | 'breach' | 'critico'
}

function valorDoLimite(
  expo: ExposicaoAtual,
  limite: { escopo: string; escopoFiltro: any; tipo: string },
): number {
  const filtro = limite.escopoFiltro || {}
  const baseEscopo = (() => {
    switch (limite.escopo) {
      case 'total':
        return expo.total
      case 'cultura':
        return expo.porCultura[filtro.cultura] ?? { usd: 0, brl: 0, qtdSc: 0 }
      case 'corretor':
        return expo.porCorretor[filtro.corretorId] ?? { usd: 0, brl: 0 }
      case 'mesa':
        return expo.porMesa[filtro.mesaId] ?? { usd: 0, brl: 0 }
      case 'contraparte':
        return expo.porContraparte[filtro.contraparte] ?? { usd: 0, brl: 0 }
      case 'regiao':
        return expo.porRegiao[filtro.uf] ?? { usd: 0, brl: 0 }
      default:
        return { usd: 0, brl: 0 }
    }
  })() as ExposicaoBucket

  switch (limite.tipo) {
    case 'exposicao_usd':
      return baseEscopo.usd ?? 0
    case 'exposicao_brl':
      return baseEscopo.brl ?? 0
    case 'qtd_sc':
      return baseEscopo.qtdSc ?? 0
    case 'pnl_neg_usd':
      // tratado externamente; aqui retorna 0 (cron calcula com posições)
      return 0
    case 'var_usd':
      return 0
    default:
      return 0
  }
}

export function classificarSeveridade(
  valorAtual: number,
  valorMaximo: number,
  valorAviso: number,
): { severidade: 'aviso' | 'breach' | 'critico' | null; excedidoPct: number } {
  if (valorMaximo <= 0) return { severidade: null, excedidoPct: 0 }
  const excedidoPct = ((valorAtual - valorMaximo) / valorMaximo) * 100
  if (valorAtual >= valorMaximo * 1.2) return { severidade: 'critico', excedidoPct }
  if (valorAtual >= valorMaximo) return { severidade: 'breach', excedidoPct }
  if (valorAtual >= valorAviso) return { severidade: 'aviso', excedidoPct }
  return { severidade: null, excedidoPct }
}

export async function detectarBreaches(
  workspaceId: string,
  expoOverride?: ExposicaoAtual,
): Promise<BreachCandidato[]> {
  const expo = expoOverride ?? (await calcularExposicaoAtual(workspaceId))
  const limites = await db.limiteRisco.findMany({
    where: { workspaceId, ativo: true },
  })

  const out: BreachCandidato[] = []
  for (const l of limites) {
    const valorMaximo = Number(l.valorMaximo)
    const valorAviso =
      l.valorAviso !== null && l.valorAviso !== undefined
        ? Number(l.valorAviso)
        : valorMaximo * 0.8
    const valorAtual = valorDoLimite(expo, {
      escopo: l.escopo,
      escopoFiltro: l.escopoFiltro,
      tipo: l.tipo,
    })
    const { severidade, excedidoPct } = classificarSeveridade(
      valorAtual,
      valorMaximo,
      valorAviso,
    )
    if (!severidade) continue
    out.push({
      limiteId: l.id,
      escopo: l.escopo,
      tipo: l.tipo,
      escopoFiltro: l.escopoFiltro,
      valorAtual,
      valorMaximo,
      valorAviso,
      excedidoEm: excedidoPct,
      severidade,
    })
  }
  return out
}
