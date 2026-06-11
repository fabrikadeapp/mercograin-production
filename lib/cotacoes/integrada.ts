/**
 * Motor integrado de cotações — combina as DUAS visões da mesa de originação:
 *
 *   1. PREÇO  → PRÊMIO  (visão "planilha PREMIOS"):
 *      a partir do preço de balcão (R$/sc60) que a trading paga, deriva o
 *      prêmio (basis) implícito em US$/bu que ela está embutindo.
 *
 *   2. PRÊMIO → PREÇO  (visão "SIMULADOR CBOT"):
 *      a partir do prêmio informado (US¢/bu) que a trading divulga, forma o
 *      preço de balcão (R$/sc60) que ela deveria pagar.
 *
 * Com as duas visões lado a lado conseguimos calcular o SPREAD entre o que a
 * trading divulga (prêmio informado) e o que o preço de balcão dela realmente
 * embute (prêmio implícito) — base para arbitragem e negociação.
 *
 * Lógica PURA — sem DB, sem framework, sem data/hora do sistema.
 * Reutiliza simularPrecoGrao() de ./simulador para a direção prêmio → preço.
 * A fórmula de prêmio implícito é REPLICADA aqui (não depende de premios.ts).
 *
 * ── Fórmula da planilha PREMIOS (preço de balcão → prêmio implícito) ──────────
 *
 *   PREMIO_usd_bu =
 *     ( ( (PRECO_BALCAO_brl_sc ÷ CAMBIO) × 16,6667 + 12 ) ÷ 36,74541 ) − CHICAGO_usd_bu
 *
 *   onde:
 *     PRECO_BALCAO  : R$/saca de 60 kg pago no balcão
 *     CAMBIO        : USD/BRL do mês de vencimento
 *     16,6667       : sacas de 60 kg por tonelada (1.000 / 60)
 *     +12           : custo fixo de FOBBINGS em US$/tonelada (sinal positivo na planilha)
 *     36,74541      : fator bushel→tonelada da soja (constante da planilha)
 *     CHICAGO       : CBOT em US$/bushel do mês
 *
 *   IF PRECO_BALCAO <= 0  →  retorna 0 (sem prêmio informado / linha vazia).
 *
 * Nota de sinal: na planilha PREMIOS o FOBBINGS entra como "+12" (custo somado
 * em US$/t na conta do prêmio implícito). Já o `simularPrecoGrao` recebe
 * `fobbingsUsdTon` como custo NEGATIVO (ex.: -12). Para coerência entre as duas
 * direções, derivamos o termo da planilha como `-fobbingsUsdTon` (um FOBBINGS
 * de -12 vira o "+12" da fórmula).
 */

import { simularPrecoGrao, type GraoSimulador } from './simulador'

/** Sacas de 60 kg por tonelada — constante 16,6667 da planilha (1.000 / 60). */
const SACAS_POR_TONELADA = 16.6667

/** Fator bushel→tonelada da soja usado pela planilha PREMIOS. */
const FATOR_BU_TON_PLANILHA = 36.74541

/**
 * Base de mercado compartilhada pelas duas visões: define CBOT, câmbio,
 * FOBBINGS e frete que valem para a comparação de um grão num dado vencimento.
 */
export interface VisaoIntegrada {
  grao: GraoSimulador
  /** Cotação CBOT/Chicago em centavos de dólar por bushel (US¢/bu). */
  cbotCentavosBu: number
  /** Câmbio USD/BRL do mês. */
  cambioUsdBrl: number
  /** FOBBINGS — custo de embarque em US$/tonelada. Tipicamente NEGATIVO (ex.: -12). */
  fobbingsUsdTon: number
  /** Frete rodoviário até o porto, em R$/saca de 60 kg. */
  freteBrlSc: number
}

/** Linha de trading: pode informar o prêmio divulgado e/ou o preço de balcão. */
export interface TradingComparavel {
  nome: string
  /** Prêmio divulgado pela trading, em US¢/bu (ex.: 55 = US$ 0,55/bu). Opcional. */
  premioCentavosBu?: number
  /** Preço de balcão que a trading paga, em R$/saca de 60 kg. Opcional. */
  precoBalcaoBrlSc?: number
}

/** Resultado integrado por trading, com as duas visões e o spread. */
export interface LinhaComparada {
  nome: string
  /** Prêmio informado pela trading em US¢/bu (null se não informado). */
  premioInformadoCentavosBu: number | null
  /**
   * Preço de balcão formado a partir do prêmio informado (R$/sc60), via
   * simularPrecoGrao. Se não houver prêmio informado, cai para o preço de
   * balcão informado pela trading (ou 0 quando nenhum dos dois existe).
   */
  precoFormadoBrlSc: number
  /**
   * Prêmio implícito (US$/bu) derivado do preço de balcão informado pela
   * fórmula da planilha PREMIOS (null se não houver preço de balcão informado).
   */
  premioImplicitoUsdBu: number | null
  /**
   * Spread = prêmio implícito (do preço de balcão) − prêmio informado, em US$/bu.
   * Positivo → o preço de balcão embute MAIS prêmio do que a trading divulga
   * (a trading paga melhor do que diz). Null quando faltar uma das pontas.
   */
  spread: number | null
}

/**
 * Direção PREÇO → PRÊMIO (planilha PREMIOS): deriva o prêmio implícito em
 * US$/bu a partir do preço de balcão em R$/sc60, usando o CBOT, câmbio e
 * FOBBINGS da base. Retorna 0 quando o preço de balcão é <= 0.
 */
export function premioImplicitoUsdBu(base: VisaoIntegrada, precoBalcaoBrlSc: number): number {
  if (precoBalcaoBrlSc <= 0) return 0
  if (base.cambioUsdBrl <= 0) return 0

  const chicagoUsdBu = base.cbotCentavosBu / 100
  // FOBBINGS entra como custo POSITIVO na conta da planilha (-(-12) = +12).
  const fobbingsTermo = -base.fobbingsUsdTon

  const usdPorTonelada = (precoBalcaoBrlSc / base.cambioUsdBrl) * SACAS_POR_TONELADA + fobbingsTermo
  return usdPorTonelada / FATOR_BU_TON_PLANILHA - chicagoUsdBu
}

/**
 * Direção PRÊMIO → PREÇO (simulador CBOT): forma o preço de balcão (R$/sc60,
 * FOB origem após frete) a partir do prêmio informado em US¢/bu.
 */
export function precoFormadoBrlSc(base: VisaoIntegrada, premioCentavosBu: number): number {
  const r = simularPrecoGrao({
    grao: base.grao,
    cbotCentavosBu: base.cbotCentavosBu,
    premioCentavosBu,
    fobbingsUsdTon: base.fobbingsUsdTon,
    cambioUsdBrl: base.cambioUsdBrl,
    fretePorSacaBrl: base.freteBrlSc,
  })
  return r.brlPorSacaFobOrigem
}

/**
 * Compara uma lista de tradings combinando as duas visões. Para cada trading:
 *
 *   - se houver prêmio informado: forma o preço de balcão via simulador;
 *   - se houver preço de balcão: deriva o prêmio implícito via planilha;
 *   - se ambos existirem: calcula o spread (implícito − informado, em US$/bu).
 *
 * Ordena do MELHOR preço formado (maior R$/sc) para o pior.
 */
export function compararTradings(
  base: VisaoIntegrada,
  tradings: TradingComparavel[],
): LinhaComparada[] {
  return tradings
    .map((t): LinhaComparada => {
      const temPremio = typeof t.premioCentavosBu === 'number' && Number.isFinite(t.premioCentavosBu)
      const temPreco =
        typeof t.precoBalcaoBrlSc === 'number' && Number.isFinite(t.precoBalcaoBrlSc)

      const premioInformadoCentavosBu = temPremio ? (t.premioCentavosBu as number) : null

      // Preço formado: a partir do prêmio informado; se não houver, usa o
      // preço de balcão informado; senão 0.
      const precoFormado = temPremio
        ? precoFormadoBrlSc(base, t.premioCentavosBu as number)
        : temPreco
          ? (t.precoBalcaoBrlSc as number)
          : 0

      // Prêmio implícito: só faz sentido quando há preço de balcão informado.
      const premioImplicito = temPreco
        ? premioImplicitoUsdBu(base, t.precoBalcaoBrlSc as number)
        : null

      // Spread em US$/bu: implícito − informado (informado convertido ¢→US$).
      const spread =
        premioImplicito != null && premioInformadoCentavosBu != null
          ? premioImplicito - premioInformadoCentavosBu / 100
          : null

      return {
        nome: t.nome,
        premioInformadoCentavosBu,
        precoFormadoBrlSc: precoFormado,
        premioImplicitoUsdBu: premioImplicito,
        spread,
      }
    })
    .sort((a, b) => b.precoFormadoBrlSc - a.precoFormadoBrlSc)
}

/** Resumo agregado do mercado a partir das linhas comparadas. */
export interface ResumoMercado {
  /** Trading com o melhor preço formado (R$/sc). Null se a lista for vazia. */
  melhorTrading: LinhaComparada | null
  /** Maior preço de balcão formado, em R$/sc. Null se vazio. */
  melhorPrecoBrlSc: number | null
  /** Prêmio informado médio (US¢/bu), considerando apenas quem informou. Null se ninguém informou. */
  premioMedioCentavosBu: number | null
  /** Maior spread (US$/bu) entre as tradings com as duas pontas. Null se nenhuma teve spread. */
  melhorSpread: number | null
  /** Trading dona do maior spread. Null se nenhuma teve spread. */
  melhorSpreadTrading: LinhaComparada | null
  /** Quantidade de tradings avaliadas. */
  totalTradings: number
}

/**
 * Sintetiza o mercado a partir da base e da lista de tradings: melhor preço,
 * prêmio médio informado e melhor spread.
 */
export function resumoMercado(
  base: VisaoIntegrada,
  tradings: TradingComparavel[],
): ResumoMercado {
  const linhas = compararTradings(base, tradings)

  if (linhas.length === 0) {
    return {
      melhorTrading: null,
      melhorPrecoBrlSc: null,
      premioMedioCentavosBu: null,
      melhorSpread: null,
      melhorSpreadTrading: null,
      totalTradings: 0,
    }
  }

  // compararTradings já ordena por melhor preço → o topo é o melhor.
  const melhorTrading = linhas[0]

  const premiosInformados = linhas
    .map((l) => l.premioInformadoCentavosBu)
    .filter((p): p is number => p != null)
  const premioMedioCentavosBu =
    premiosInformados.length > 0
      ? premiosInformados.reduce((s, p) => s + p, 0) / premiosInformados.length
      : null

  let melhorSpreadTrading: LinhaComparada | null = null
  for (const l of linhas) {
    if (l.spread == null) continue
    if (melhorSpreadTrading == null || l.spread > (melhorSpreadTrading.spread as number)) {
      melhorSpreadTrading = l
    }
  }

  return {
    melhorTrading,
    melhorPrecoBrlSc: melhorTrading.precoFormadoBrlSc,
    premioMedioCentavosBu,
    melhorSpread: melhorSpreadTrading ? melhorSpreadTrading.spread : null,
    melhorSpreadTrading,
    totalTradings: linhas.length,
  }
}
