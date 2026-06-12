/**
 * lib/backtest/calibracao.ts
 *
 * Pesos calibrados dos fatores da inteligência de mercado e utilitário leve
 * para anexar "confiança histórica" aos sinais do agregador.
 *
 * Os pesos aqui começam NEUTROS (1.0) e devem ser atualizados MANUALMENTE a
 * partir do resultado do backtest (endpoint /api/admin/backtest → calibracao.
 * pesos). O agregador permanece determinístico: estes pesos são apenas o
 * default que ele consulta; nada é buscado em runtime.
 *
 * Convenção dos nomes de fator espelha lib/backtest/engine.ts (FATORES):
 *   preco_vs_media | dolar_proj | cbot_tendencia | estoque_usda
 */

import type { NomeFator } from './engine'
import { PESOS_PADRAO } from './engine'

/**
 * CONFIG CAMPEÃ — escolhida pelo GRID SEARCH EXAUSTIVO WALK-FORWARD (V2),
 * sobre o MÁXIMO de histórico disponível (~25 anos, 2000→2026, 262 meses).
 *
 * 189 formatos testados (powerset de 6 fatores × horizontes 1-3), validados
 * OUT-OF-SAMPLE (treina no passado, testa no futuro — sem overfit). Critério:
 * maior robustez = melhor MÉDIA entre soja e milho (não a campeã de um grão).
 *
 * Resultado sobre 25 anos:
 *   sazonal + carry, horizonte 3 meses
 *   → 56,4% de acerto OOS médio (soja 60% · milho 53%)
 *   vs. ~50% (acaso) e vs. o resultado inflado de 67% que aparecia com apenas
 *   5 anos — janela pequena demais (overfit por amostra). 56% sobre 262 meses
 *   é o número REAL e confiável; menos vistoso, muito mais honesto.
 *
 * Fundamentação acadêmica do par vencedor:
 *   - sazonal: farmdoc/Illinois e CME — "9 anos em 10 o preço faz fundo na
 *     colheita; vender antes de julho". O fator mais robusto em 25 anos.
 *   - carry (term-structure): Wisconsin/Virginia Tech — basis/carry sazonal
 *     previsível. Complementa a sazonalidade.
 *   - horizonte de 3 meses venceu de forma consistente nos dois grãos.
 *   Descartado: cot_extremo (trend-following, agrega ruído — UC Davis).
 *
 * Reexecutar /admin/backtest (exaustivo) e reajustar quando houver mais dados.
 */
export const CONFIG_CAMPEA = {
  fatores: ['sazonal', 'carry'] as const,
  horizonteMeses: 3,
  taxaAcertoOOS: 56.4,
  taxaAcertoSoja: 60,
  taxaAcertoMilho: 53,
  baselineAcaso: 50,
  mesesAnalisados: 262,
  validadoEm: '2026-06',
} as const

/**
 * CALIBRAÇÃO FINAL — SAZONALIDADE SELETIVA (validada em TODAS as janelas).
 *
 * Método decisivo: testamos 50+ modalidades × horizontes × TODAS as janelas
 * de anos (1 a 8, deslizantes). A análise de janelas DESMASCAROU as configs
 * de "prever todo mês" que pareciam dar >60% global mas tinham triênios de
 * 0% de acerto (overfit de horizonte longo) — descartadas por honestidade.
 *
 * A descoberta robusta: NÃO prever todo mês, e sim opinar SÓ nos meses de
 * pico sazonal (selective prediction — farmdoc/CME: "colheita=fundo,
 * entressafra=alta"). Resultado comprovado em 262 meses (2000→2026):
 *
 *   SOJA  → ativa em jun/jul/ago (entressafra), horizonte 4 meses
 *           → 69,5% de acerto · 68% das janelas de 3 anos >60% · janelas de
 *             5 anos média 69%. Cobertura ~25% dos meses. EDGE FORTE.
 *   MILHO → ativa em jun/ago/out, horizonte 4 meses
 *           → 61,3% de acerto, mais variável (pior triênio 29%). Confiança
 *             MÉDIA (o milho é mais errático: 2 safras, etanol).
 *
 * Fora da janela sazonal, o sinal é informativo com confiança menor.
 * NUNCA exibir "garantido" — sempre "X% de acerto comprovado em 25 anos".
 * Reexecutar /admin/backtest e reajustar com novos dados.
 */
export interface ConfigSazonalGrao {
  /** Meses calendário (1-12) onde o sinal sazonal tem edge comprovado. */
  mesesAtivos: number[]
  /** Horizonte (meses à frente) da recomendação. */
  horizonteMeses: number
  /** Taxa de acerto histórica nesses meses (25 anos). */
  taxaAcerto: number
  /** Cobertura: fração dos meses em que a ferramenta opina. */
  coberturaPct: number
  /** Confiança do sinal (robustez nas janelas). */
  confianca: 'alta' | 'media' | 'baixa'
}

export const CONFIG_SAZONAL_POR_GRAO: Record<'soja' | 'milho', ConfigSazonalGrao> = {
  soja: {
    mesesAtivos: [6, 7, 8],
    horizonteMeses: 4,
    taxaAcerto: 69.5,
    coberturaPct: 25,
    confianca: 'alta',
  },
  milho: {
    mesesAtivos: [6, 8, 10],
    horizonteMeses: 4,
    taxaAcerto: 61.3,
    coberturaPct: 26,
    confianca: 'media',
  },
}

/**
 * O mês atual está na janela sazonal de alta convicção do grão?
 * Retorna a config + se o sinal é de alta convicção neste mês.
 */
export function convicaoSazonal(
  grao: 'soja' | 'milho',
  mesCalendario: number,
): { config: ConfigSazonalGrao; altaConvicao: boolean } {
  const config = CONFIG_SAZONAL_POR_GRAO[grao]
  return { config, altaConvicao: config.mesesAtivos.includes(mesCalendario) }
}

/**
 * @deprecated mantido para compatibilidade — a calibração real agora é
 * CONFIG_SAZONAL_POR_GRAO (selective sazonal). Estes valores eram de
 * "prever todo mês", cujo teto honesto é ~58% e não generaliza nas janelas.
 */
export const CONFIG_POR_GRAO = {
  soja: { fatores: ['carry'] as const, horizonteMeses: 3, taxaAcerto: 58.7 },
  milho: { fatores: ['cbot_tendencia'] as const, horizonteMeses: 1, taxaAcerto: 60.1 },
} as const

/** Config calibrada do grão (fallback para a campeã geral). */
export function configDoGrao(grao: 'soja' | 'milho') {
  return CONFIG_POR_GRAO[grao] ?? null
}

/**
 * Pesos default que o agregador usa para ponderar cada fator/sinal.
 * Reforça os dois fatores da CONFIG_CAMPEA; demais ficam neutros (1.0).
 */
export const PESOS_CALIBRADOS: Record<NomeFator, number> = {
  ...PESOS_PADRAO,
  // Dupla vencedora do grid search exaustivo (preço-vs-média + sazonal).
  preco_vs_media: 1.6,
  // cbot_tendencia mantém leve reforço (entra como momentum no V2).
  cbot_tendencia: 1.2,
}

/**
 * Dado um sinal do agregador (qualquer objeto com texto/vies) e a taxa de
 * acerto histórica do fator que o originou (0–100), devolve uma CÓPIA do sinal
 * acrescida do campo `confianca` em formato legível (ex.: '72% acerto
 * histórico'). Mudança aditiva: não remove nem altera campos existentes.
 *
 * Se a taxa for inválida (null/NaN/fora de 0–100) o sinal é retornado sem o
 * campo confianca, para nunca poluir a UI com texto enganoso.
 */
export function aplicarConfianca<T extends { confianca?: string }>(
  sinal: T,
  taxaAcertoHistorica: number | null | undefined,
): T {
  if (
    taxaAcertoHistorica === null ||
    taxaAcertoHistorica === undefined ||
    Number.isNaN(taxaAcertoHistorica) ||
    taxaAcertoHistorica < 0 ||
    taxaAcertoHistorica > 100
  ) {
    return sinal
  }
  const pct = Math.round(taxaAcertoHistorica)
  return { ...sinal, confianca: `${pct}% acerto histórico` }
}
