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
 * CONFIG CAMPEÃ — escolhida pelo GRID SEARCH EXAUSTIVO WALK-FORWARD (V2).
 *
 * 189 formatos testados (powerset de 6 fatores × horizontes 1-3), validados
 * OUT-OF-SAMPLE (treina no passado, testa no futuro — sem overfit). Critério
 * de escolha: maior robustez = melhor MÉDIA entre soja e milho (não a campeã
 * de um grão só, que generaliza mal).
 *
 * Resultado (mai/2026):
 *   preco_vs_media + sazonal, horizonte 3 meses
 *   → 67,4% de acerto OOS médio (soja 70% · milho 65%)
 *   vs. ~50% do baseline V1 (sem sazonalidade).
 *
 * Fundamentação acadêmica do par vencedor:
 *   - preco_vs_media (contrarian): melhor fator isolado do V1 (58%).
 *   - sazonal: farmdoc/Illinois e CME — "9 anos em 10 o preço faz fundo na
 *     colheita; vender antes de julho". É o fator que mais elevou a acurácia.
 *   Descartados: cot_extremo (trend-following, agrega ruído — UC Davis) e
 *   carry (forte em soja, frágil em milho — não generaliza).
 *
 * Reexecutar /admin/backtest (exaustivo) e reajustar quando houver mais dados.
 */
export const CONFIG_CAMPEA = {
  fatores: ['preco_vs_media', 'sazonal'] as const,
  horizonteMeses: 3,
  taxaAcertoOOS: 67.4,
  taxaAcertoSoja: 70,
  taxaAcertoMilho: 65,
  baselineV1: 50,
  validadoEm: '2026-06',
} as const

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
