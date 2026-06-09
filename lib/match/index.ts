/**
 * Motor de match (F1-03) — cruza OFERTAS (venda) × DEMANDAS (compra).
 *
 * Score de compatibilidade 0–100 ponderado por: cultura (eliminatório),
 * volume, faixa de preço, base/região (origem×destino) e janela de entrega.
 * Puro e testável; o I/O fica no endpoint.
 */

export interface OfertaLike {
  id: string
  tipo: string // 'compra' | 'venda'
  cultura: string
  qtdSc: number
  precoSc: number
  precoMoeda?: string
  origem?: string | null
  destino?: string | null
  janelaEntrega?: string | Date | null
  qualidadeSpec?: Record<string, number> | null
}

export interface MatchResult {
  ofertaId: string
  demandaId: string
  score: number
  razoes: string[]
}

const PESOS = { volume: 30, preco: 30, regiao: 15, janela: 10, qualidade: 15 }

function clamp01(n: number) { return Math.max(0, Math.min(1, n)) }

/** Compatibilidade de volume: penaliza diferença relativa de quantidade. */
function scoreVolume(venda: number, compra: number): number {
  if (venda <= 0 || compra <= 0) return 0
  const ratio = Math.min(venda, compra) / Math.max(venda, compra)
  return clamp01(ratio) // 1 = volumes iguais
}

/** Preço: 1 se compra ≥ venda (negócio fecha), decai conforme gap. */
function scorePreco(precoVenda: number, precoCompra: number): number {
  if (precoVenda <= 0 || precoCompra <= 0) return 0
  if (precoCompra >= precoVenda) return 1
  const gap = (precoVenda - precoCompra) / precoVenda
  return clamp01(1 - gap * 4) // gap de 25% zera
}

/** Região: destino da venda casa com origem/destino da demanda. */
function scoreRegiao(venda: OfertaLike, compra: OfertaLike): number {
  if (!venda.destino && !compra.destino && !venda.origem && !compra.origem) return 0.5
  if (venda.destino && compra.destino && venda.destino === compra.destino) return 1
  if (venda.origem && compra.origem && venda.origem === compra.origem) return 0.7
  return 0.3
}

/** Janela: proximidade das datas alvo (≤7d = 1, decai até 60d). */
function scoreJanela(venda: OfertaLike, compra: OfertaLike): number {
  const a = venda.janelaEntrega ? new Date(venda.janelaEntrega).getTime() : null
  const b = compra.janelaEntrega ? new Date(compra.janelaEntrega).getTime() : null
  if (a == null || b == null) return 0.5
  const dias = Math.abs(a - b) / 86_400_000
  if (dias <= 7) return 1
  return clamp01(1 - (dias - 7) / 53)
}

/** Qualidade: compara specs numéricas (umidade, avariados menor=melhor; proteína/PH compatível). */
function scoreQualidade(venda: OfertaLike, compra: OfertaLike): number {
  const ofer = venda.qualidadeSpec
  const dem = compra.qualidadeSpec
  if (!ofer || !dem) return 0.6 // sem spec, neutro-favorável
  const chaves = Object.keys(dem)
  if (chaves.length === 0) return 0.6
  let soma = 0
  for (const k of chaves) {
    const exigido = dem[k]
    const ofertado = ofer[k]
    if (ofertado == null) { soma += 0.5; continue }
    // umidade/avariados: oferta deve ser ≤ exigido (limite máximo)
    if (/umidade|avariad|impureza/i.test(k)) {
      soma += ofertado <= exigido ? 1 : clamp01(1 - (ofertado - exigido) / Math.max(exigido, 1))
    } else {
      // ph/proteina: oferta deve ser ≥ exigido (mínimo)
      soma += ofertado >= exigido ? 1 : clamp01(1 - (exigido - ofertado) / Math.max(exigido, 1))
    }
  }
  return soma / chaves.length
}

/** Calcula o score de match entre uma venda e uma demanda de compra. */
export function scoreMatch(venda: OfertaLike, compra: OfertaLike): MatchResult | null {
  // Cultura é eliminatória.
  if (venda.cultura !== compra.cultura) return null
  if (venda.tipo !== 'venda' || compra.tipo !== 'compra') return null

  const sVol = scoreVolume(venda.qtdSc, compra.qtdSc)
  const sPre = scorePreco(venda.precoSc, compra.precoSc)
  const sReg = scoreRegiao(venda, compra)
  const sJan = scoreJanela(venda, compra)
  const sQua = scoreQualidade(venda, compra)

  const score = Math.round(
    sVol * PESOS.volume + sPre * PESOS.preco + sReg * PESOS.regiao +
    sJan * PESOS.janela + sQua * PESOS.qualidade,
  )

  const razoes: string[] = []
  if (sPre >= 0.99) razoes.push('preço fecha (compra ≥ venda)')
  else if (sPre >= 0.7) razoes.push('preço próximo')
  if (sVol >= 0.85) razoes.push('volume compatível')
  if (sReg >= 1) razoes.push('mesma região de destino')
  if (sJan >= 0.85) razoes.push('janela alinhada')
  if (sQua >= 0.85) razoes.push('qualidade atende')

  return { ofertaId: venda.id, demandaId: compra.id, score, razoes }
}

/**
 * Sugere matches: para cada venda, ranqueia as demandas compatíveis.
 * Retorna pares ordenados por score (desc), acima do limiar mínimo.
 */
export function sugerirMatches(
  ofertas: OfertaLike[],
  minScore = 40,
): MatchResult[] {
  const vendas = ofertas.filter((o) => o.tipo === 'venda')
  const compras = ofertas.filter((o) => o.tipo === 'compra')
  const out: MatchResult[] = []
  for (const v of vendas) {
    for (const c of compras) {
      const m = scoreMatch(v, c)
      if (m && m.score >= minScore) out.push(m)
    }
  }
  return out.sort((a, b) => b.score - a.score)
}
