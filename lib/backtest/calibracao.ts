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
 * Pesos default que o agregador deve usar para ponderar cada fator/sinal.
 *
 * CALIBRADO com backtest REAL de soja, 50 meses (jul/2021–mai/2026), gabarito
 * preço físico IPEA + CBOT + câmbio. Taxa de acerto por fator no horizonte de
 * 2 meses:
 *   preco_vs_media  → 58%  (melhor edge — peso reforçado)
 *   cbot_tendencia  → 53%  (edge leve — peso ligeiramente acima do neutro)
 *   dolar_proj      → s/ amostra no backtest histórico (mantido neutro)
 *   estoque_usda    → s/ amostra no backtest histórico (mantido neutro)
 * Pesos proporcionais ao edge acima de 50% (50% = aleatório = peso 1,0).
 * Reexecutar /admin/backtest e reajustar quando houver mais dados.
 */
export const PESOS_CALIBRADOS: Record<NomeFator, number> = {
  ...PESOS_PADRAO,
  preco_vs_media: 1.6,
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
