/**
 * lib/backtest/sazonalidade.ts
 *
 * Fator SAZONAL da inteligência de mercado — o de MAIOR poder esperado segundo
 * a literatura (farmdoc/Illinois, CME): "9 anos em 10 o preço de soja/milho faz
 * fundo na colheita; soja forte no fim do inverno/primavera, fraca no fim do
 * verão; vender antes de julho".
 *
 * MÓDULO PURO: NÃO faz fetch, NÃO usa data/hora do sistema. Tudo entra por
 * parâmetro (mês calendário 1–12 e a própria série de preço), tornando-o 100%
 * determinístico e testável (modelo engine.ts).
 *
 * Ideia central: para cada mês calendário (jan=1 … dez=12), medir o RETORNO
 * MÉDIO histórico do preço físico nos H meses seguintes. Meses cujo retorno
 * médio é NEGATIVO (preço tende a cair depois) sinalizam VENDER agora; meses
 * com retorno médio POSITIVO (preço tende a subir) sinalizam SEGURAR/ESPERAR.
 *
 * Convenção do viés (coerente com engine.ts):
 *  - direcao  ∈ [-1, +1]: negativo = tende a cair = vender; positivo = tende a
 *    subir = segurar/esperar.
 *  - forca    ∈ [0, 1]: intensidade do viés (|direcao|).
 */

/**
 * Padrões sazonais hardcoded de FALLBACK (R$/saca em base relativa: retorno
 * médio esperado, em fração, do mês para os meses seguintes). Usados quando a
 * série histórica é curta demais para estimar com confiança.
 *
 * Coerentes com a literatura para o Brasil (Hemisfério Sul):
 *  - SOJA: colheita BR fev–abr → pico de oferta → preço fraco/queda (retorno
 *    seguinte negativo). Entressafra / fim de inverno (jul–set) → preço firme,
 *    tende a subir. Mensagem "vender antes de julho" embutida: meses pré-julho
 *    (fev–jun) carregam viés de queda; segundo semestre tende a recuperar.
 *  - MILHO: 2ª safra (safrinha) colhe jun–ago → pressão de oferta no inverno →
 *    preço fraco nesse período; recuperação no fim do ano / início do ano antes
 *    da safra de verão.
 *
 * Valores em fração (ex.: -0.04 = tende a cair ~4% nos meses seguintes).
 */
export const SAZONALIDADE_SOJA: Record<number, number> = {
  1: -0.02, // jan — início da colheita BR se aproxima → pressão
  2: -0.04, // fev — colheita BR ganha força → queda
  3: -0.05, // mar — pico da colheita BR → mais fraco
  4: -0.04, // abr — oferta abundante pós-colheita
  5: -0.03, // mai — ainda pressionado (vender antes de julho)
  6: -0.02, // jun — pré-julho, viés de queda residual
  7: 0.02, // jul — vira a entressafra → começa a firmar
  8: 0.04, // ago — fim de inverno → preço forte (literatura)
  9: 0.04, // set — entressafra → firme
  10: 0.03, // out — plantio BR, prêmio de incerteza
  11: 0.02, // nov — desenvolvimento da safra de verão
  12: 0.01, // dez — neutro/levemente positivo
}

export const SAZONALIDADE_MILHO: Record<number, number> = {
  1: 0.02, // jan — entressafra antes da safra de verão → firme
  2: 0.02, // fev — ainda firme
  3: 0.01, // mar — colheita verão se aproxima
  4: -0.02, // abr — colheita 1ª safra → pressão
  5: -0.03, // mai — safrinha se aproxima → oferta crescente
  6: -0.04, // jun — colheita safrinha → preço fraco
  7: -0.04, // jul — pico safrinha → mais fraco
  8: -0.03, // ago — oferta da safrinha ainda pesa
  9: -0.01, // set — começa a escoar estoque
  10: 0.02, // out — entressafra → recuperação
  11: 0.03, // nov — firme antes da safra de verão
  12: 0.03, // dez — entressafra → forte
}

/**
 * Extrai o mês calendário (1–12) de uma string 'YYYY-MM'. Retorna null se
 * inválida (defensivo; nunca lança).
 */
function mesCalendarioDe(mes: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(mes)
  if (!m) return null
  const cal = Number(m[2])
  if (!Number.isInteger(cal) || cal < 1 || cal > 12) return null
  return cal
}

/**
 * PURA: para cada mês calendário (1–12), calcula o RETORNO MÉDIO histórico do
 * preço físico nos H meses seguintes. Revela os padrões sazonais da própria
 * série (ex.: colheita BR fev–abr tende a cair → retornos negativos nesses
 * meses).
 *
 * Para cada ponto i com i+H dentro da série, computa a variação relativa
 * (precoFisico[i+H] - precoFisico[i]) / precoFisico[i] e a agrupa pelo mês
 * calendário de i. O resultado por mês é a média dessas variações (fração).
 *
 * Meses sem nenhuma observação NÃO aparecem no Record (não inventa dado).
 */
export function retornoMedioPorMes(
  serie: { mes: string; precoFisico: number }[],
  horizonteMeses: number,
): Record<number, number> {
  const H = Math.max(1, Math.floor(horizonteMeses))
  const soma: Record<number, number> = {}
  const cont: Record<number, number> = {}

  for (let i = 0; i + H < serie.length; i++) {
    const ponto = serie[i]
    const futuro = serie[i + H]
    const cal = mesCalendarioDe(ponto.mes)
    if (cal === null) continue
    if (ponto.precoFisico === 0 || !Number.isFinite(ponto.precoFisico)) continue
    if (!Number.isFinite(futuro.precoFisico)) continue

    const ret = (futuro.precoFisico - ponto.precoFisico) / ponto.precoFisico
    soma[cal] = (soma[cal] ?? 0) + ret
    cont[cal] = (cont[cal] ?? 0) + 1
  }

  const media: Record<number, number> = {}
  for (const k of Object.keys(cont)) {
    const cal = Number(k)
    media[cal] = soma[cal] / cont[cal]
  }
  return media
}

/**
 * Normaliza um retorno médio (fração) em direção ∈ [-1, +1]. Um retorno de
 * ±NORMALIZADOR_SAZONAL (5%) satura o viés. Negativo = tende a cair = vender;
 * positivo = tende a subir = segurar.
 */
export const NORMALIZADOR_SAZONAL = 0.05

/**
 * Dado o mês calendário (1–12) e os padrões (retorno médio por mês, fração),
 * retorna o viés sazonal:
 *  - direcao ∈ [-1, +1]: sinal do retorno esperado (negativo = vender; positivo
 *    = segurar/esperar), saturado por NORMALIZADOR_SAZONAL.
 *  - forca   ∈ [0, 1]: |direcao| (intensidade do viés).
 *
 * Se o mês não tiver padrão (ausente nos `padroes`), o viés é neutro
 * (direcao 0, forca 0) — nunca inventa direção.
 */
export function vieSazonal(
  mesCalendario: number,
  padroes: Record<number, number>,
): { direcao: number; forca: number } {
  const ret = padroes[mesCalendario]
  if (ret === undefined || ret === null || !Number.isFinite(ret)) {
    return { direcao: 0, forca: 0 }
  }
  const bruto = ret / NORMALIZADOR_SAZONAL
  const direcao = Math.max(-1, Math.min(1, bruto))
  return { direcao, forca: Math.abs(direcao) }
}
