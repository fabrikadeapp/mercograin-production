/**
 * lib/backtest/engine-v2.ts
 *
 * Motor ESTENDIDO do backtest (V2). REUTILIZA tudo que faz sentido de engine.ts
 * (tipos, helpers de acerto/retorno, JANELA_MEDIA) e ADICIONA os fatores
 * fundamentados na literatura acadêmica, além de um grid search EXAUSTIVO
 * walk-forward (treino in-sample, medição out-of-sample) para achar a melhor
 * combinação de horizonte × subconjunto de fatores SEM overfit.
 *
 * NÃO modifica engine.ts. É um módulo PURO: NÃO faz fetch, NÃO usa data/hora do
 * sistema — tudo entra por parâmetro (modelo engine.ts/sazonalidade.ts).
 *
 * Fatores (cada um com regra explicável, direção ∈ [-1,+1]; positivo = tende a
 * subir = segurar/esperar; negativo = tende a cair = vender):
 *  - preco_vs_media : CONTRARIAN. Preço acima da média → propenso a corrigir →
 *    vender (negativo). (reusa a regra do engine V1, melhor edge histórico 58%).
 *  - cbot_tendencia : CBOT subindo puxa o físico → esperar (positivo).
 *  - sazonal        : RETORNO MÉDIO histórico do mês calendário (farmdoc/CME).
 *    Mês com retorno seguinte negativo → vender; positivo → esperar.
 *  - cot_extremo    : CONTRARIAN (UC Davis). Managed money muito esticado (z-score
 *    alto) → risco de reversão para baixo → vender; muito short → reversão p/ cima.
 *  - carry          : term-structure (Wisconsin). Carry forte (deferido≫front) =
 *    bem suprido = baixista CP → vender; invertido (backwardation) = aperto →
 *    altista → esperar.
 *  - momentum       : tendência do CBOT em 3 meses (trend-following). CBOT subindo
 *    nos últimos 3m → esperar; caindo → vender.
 */

import {
  type Recomendacao,
  type FatorContribuicao,
  type SinalHistorico,
  type PontoSerie,
  type DetalheBacktest,
  type AtribuicaoFator,
  type ResultadoBacktest,
  PESOS_PADRAO,
  LIMIAR_RELEVANCIA,
  LIMIAR_DECISAO,
  JANELA_MEDIA,
  retornoDoSinal,
  sinalAcertou,
} from './engine'
import { vieSazonal, retornoMedioPorMes } from './sazonalidade'

// ── Fatores V2 ───────────────────────────────────────────────────────────────

/** Conjunto base de fatores do V2 (powerset gera os subconjuntos). */
export const FATORES_V2 = [
  'preco_vs_media',
  'cbot_tendencia',
  'sazonal',
  'cot_extremo',
  'carry',
  'momentum',
] as const
export type NomeFatorV2 = (typeof FATORES_V2)[number]

/** Pesos padrão (1.0) de cada fator V2. */
export const PESOS_PADRAO_V2: Record<NomeFatorV2, number> = {
  preco_vs_media: 1,
  cbot_tendencia: 1,
  sazonal: 1,
  cot_extremo: 1,
  carry: 1,
  momentum: 1,
}

/** Normalizadores (saturação) por fator, em fração. */
const NORM_PRECO = 0.1 // desvio de 10% sobre a média satura o contrarian
const NORM_CBOT = 0.05 // 5% de variação satura a tendência CBOT
const NORM_COT = 1.5 // |z| 1.5 satura o extremo COT (posição esticada)
const NORM_CARRY = 0.02 // 2% de carry satura o sinal de carry
const NORM_MOMENTUM = 0.06 // 6% em 3m satura o momentum

// ── Contexto V2 ──────────────────────────────────────────────────────────────

/**
 * Contexto de UM mês para `gerarSinalV2`. Estende o contexto do V1 com os campos
 * acadêmicos (todos OPCIONAIS — um fator sem dado simplesmente não contribui).
 */
export interface ContextoSinalV2 {
  mes: string
  precoFisico: number
  /** Média móvel do preço (janela anterior). Null se insuficiente. */
  mediaMovel: number | null
  cbot: number
  /** CBOT do mês anterior (tendência curta). Null se primeiro ponto. */
  cbotAnterior: number | null
  /** CBOT 3 meses atrás (momentum). Null se insuficiente. */
  cbot3mAtras?: number | null
  cambio?: number
  /** Mês calendário 1–12 (sazonalidade). */
  mesCalendario?: number | null
  /** Z-score do net managed money (COT). Positivo = comprado esticado. */
  cotZScore?: number | null
  /** Carry term-structure em fração ((deferido-front)/front). */
  carryPct?: number | null
  /** Surpresa de estoque vs consenso (fração). Reservado p/ uso futuro. */
  surpresaEstoque?: number | null
  /** Padrões sazonais (retorno médio por mês calendário, fração). */
  padroesSazonais?: Record<number, number>
  /** Pesos por fator (default PESOS_PADRAO_V2). */
  pesos?: Record<string, number>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Aplica a banda morta de relevância: variações pequenas viram 0. */
function comRelevancia(v: number | null): number {
  if (v === null) return 0
  return Math.abs(v) < LIMIAR_RELEVANCIA ? 0 : v
}

/** Clampa em [-1, +1]. */
function clamp1(x: number): number {
  return Math.max(-1, Math.min(1, x))
}

function pesoDe(pesos: Record<string, number> | undefined, nome: string): number {
  const p = pesos?.[nome]
  if (p === undefined || p === null || Number.isNaN(p)) {
    return (PESOS_PADRAO as Record<string, number>)[nome] ?? 1
  }
  return p
}

// ── gerarSinalV2 ─────────────────────────────────────────────────────────────

/**
 * Gera o sinal V2 somando as contribuições APENAS dos fatores em `fatoresAtivos`.
 * Cada fator, quando ativo e com dado disponível, contribui `peso * direcao`
 * (direcao ∈ [-1,+1]). Fatores fora de `fatoresAtivos` são ignorados — é isso
 * que permite o grid search testar cada subconjunto isoladamente.
 */
export function gerarSinalV2(
  contexto: ContextoSinalV2,
  fatoresAtivos: Set<string>,
  pesos?: Record<string, number>,
): SinalHistorico {
  const w = pesos ?? contexto.pesos
  const fatores: FatorContribuicao[] = []

  // 1) preço vs média (CONTRARIAN).
  if (
    fatoresAtivos.has('preco_vs_media') &&
    contexto.mediaMovel !== null &&
    contexto.mediaMovel > 0
  ) {
    const desvio = (contexto.precoFisico - contexto.mediaMovel) / contexto.mediaMovel
    const rel = comRelevancia(desvio)
    if (rel !== 0) {
      // acima da média → negativo (vender).
      const direcao = clamp1(-rel / NORM_PRECO)
      fatores.push({ nome: 'preco_vs_media', contribuicao: pesoDe(w, 'preco_vs_media') * direcao })
    }
  }

  // 2) CBOT tendência curta (mês vs mês anterior).
  if (
    fatoresAtivos.has('cbot_tendencia') &&
    contexto.cbotAnterior !== null &&
    contexto.cbotAnterior !== undefined &&
    contexto.cbotAnterior > 0
  ) {
    const v = comRelevancia((contexto.cbot - contexto.cbotAnterior) / contexto.cbotAnterior)
    if (v !== 0) {
      const direcao = clamp1(v / NORM_CBOT)
      fatores.push({ nome: 'cbot_tendencia', contribuicao: pesoDe(w, 'cbot_tendencia') * direcao })
    }
  }

  // 3) Sazonal (retorno médio histórico do mês calendário).
  if (
    fatoresAtivos.has('sazonal') &&
    contexto.mesCalendario !== null &&
    contexto.mesCalendario !== undefined &&
    contexto.padroesSazonais
  ) {
    const { direcao } = vieSazonal(contexto.mesCalendario, contexto.padroesSazonais)
    if (direcao !== 0) {
      fatores.push({ nome: 'sazonal', contribuicao: pesoDe(w, 'sazonal') * direcao })
    }
  }

  // 4) COT extremo (CONTRARIAN: comprado esticado → risco de queda → vender).
  if (
    fatoresAtivos.has('cot_extremo') &&
    contexto.cotZScore !== null &&
    contexto.cotZScore !== undefined &&
    Number.isFinite(contexto.cotZScore)
  ) {
    // z>0 (net long esticado) → contrarian negativo (vender). z<0 → positivo.
    const direcao = clamp1(-contexto.cotZScore / NORM_COT)
    if (direcao !== 0) {
      fatores.push({ nome: 'cot_extremo', contribuicao: pesoDe(w, 'cot_extremo') * direcao })
    }
  }

  // 5) Carry (forte carry = bem suprido = baixista → vender; invertido = altista).
  if (
    fatoresAtivos.has('carry') &&
    contexto.carryPct !== null &&
    contexto.carryPct !== undefined &&
    Number.isFinite(contexto.carryPct)
  ) {
    // carry>0 (deferido>front) → baixista CP → negativo (vender).
    const direcao = clamp1(-contexto.carryPct / NORM_CARRY)
    if (direcao !== 0) {
      fatores.push({ nome: 'carry', contribuicao: pesoDe(w, 'carry') * direcao })
    }
  }

  // 6) Momentum (CBOT em 3 meses; trend-following).
  if (
    fatoresAtivos.has('momentum') &&
    contexto.cbot3mAtras !== null &&
    contexto.cbot3mAtras !== undefined &&
    contexto.cbot3mAtras > 0
  ) {
    const v = comRelevancia((contexto.cbot - contexto.cbot3mAtras) / contexto.cbot3mAtras)
    if (v !== 0) {
      const direcao = clamp1(v / NORM_MOMENTUM)
      fatores.push({ nome: 'momentum', contribuicao: pesoDe(w, 'momentum') * direcao })
    }
  }

  const score = fatores.reduce((acc, f) => acc + f.contribuicao, 0)

  let recomendacao: Recomendacao
  if (score <= -LIMIAR_DECISAO) {
    recomendacao = 'vender'
  } else if (score >= LIMIAR_DECISAO) {
    recomendacao = 'esperar'
  } else {
    recomendacao = 'segurar'
  }

  return { mes: contexto.mes, recomendacao, score, fatores }
}

// ── PontoSerie V2 ────────────────────────────────────────────────────────────

/**
 * Ponto mensal V2: o PontoSerie do V1 + os novos campos (todos opcionais) que
 * alimentam os fatores acadêmicos. Mantém compatibilidade com PontoSerie.
 */
export interface PontoSerieV2 extends PontoSerie {
  /** Mês calendário 1–12 (default: derivado de `mes`). */
  mesCalendario?: number
  /** Z-score do net managed money (COT) já normalizado. */
  cotZScore?: number
  /** Carry term-structure (fração). */
  carryPct?: number
  /** Surpresa de estoque vs consenso (fração). */
  surpresaEstoque?: number
}

/** Extrai o mês calendário (1–12) de 'YYYY-MM'. Null se inválido. */
function mesCalendarioDe(mes: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(mes)
  if (!m) return null
  const cal = Number(m[2])
  if (!Number.isInteger(cal) || cal < 1 || cal > 12) return null
  return cal
}

// ── rodarBacktestV2 ──────────────────────────────────────────────────────────

export interface OptsBacktestV2 {
  horizonteMeses: number
  fatoresAtivos: Set<string>
  pesos?: Record<string, number>
  /** Padrões sazonais (retorno médio por mês). Se ausente, o fator sazonal não contribui. */
  padroesSazonais?: Record<number, number>
}

/**
 * Como rodarBacktest, mas usando gerarSinalV2 e os campos V2 da série. Para cada
 * mês com H meses de futuro, monta o contexto V2 (média móvel, CBOT anterior,
 * CBOT 3m atrás, mês calendário, COT, carry) e mede acerto/retorno vs o gabarito
 * (preço físico H meses à frente).
 */
export function rodarBacktestV2(
  serie: PontoSerieV2[],
  opts: OptsBacktestV2,
): ResultadoBacktest {
  const { fatoresAtivos, pesos, padroesSazonais } = opts
  const H = Math.max(1, Math.floor(opts.horizonteMeses))

  const detalhe: DetalheBacktest[] = []
  const atrib: Record<string, { acertos: number; total: number }> = {}

  let somaRetSinal = 0
  let somaRetBaseline = 0
  let acertos = 0

  for (let i = 0; i + H < serie.length; i++) {
    const ponto = serie[i]
    const futuro = serie[i + H]

    const inicio = Math.max(0, i - JANELA_MEDIA)
    const janela = serie.slice(inicio, i)
    const mediaMovel =
      janela.length > 0
        ? janela.reduce((acc, p) => acc + p.precoFisico, 0) / janela.length
        : null

    const mesCal = ponto.mesCalendario ?? mesCalendarioDe(ponto.mes)

    const sinal = gerarSinalV2(
      {
        mes: ponto.mes,
        precoFisico: ponto.precoFisico,
        mediaMovel,
        cbot: ponto.cbot,
        cbotAnterior: i > 0 ? serie[i - 1].cbot : null,
        cbot3mAtras: i >= 3 ? serie[i - 3].cbot : null,
        cambio: ponto.cambio,
        mesCalendario: mesCal,
        cotZScore: ponto.cotZScore ?? null,
        carryPct: ponto.carryPct ?? null,
        surpresaEstoque: ponto.surpresaEstoque ?? null,
        padroesSazonais,
        pesos,
      },
      fatoresAtivos,
      pesos,
    )

    const variacaoPct =
      ponto.precoFisico > 0
        ? ((futuro.precoFisico - ponto.precoFisico) / ponto.precoFisico) * 100
        : 0

    const acertou = sinalAcertou(sinal.recomendacao, variacaoPct)
    if (acertou) acertos++

    somaRetSinal += retornoDoSinal(sinal.recomendacao, variacaoPct)
    somaRetBaseline += retornoDoSinal('vender', variacaoPct)

    for (const f of sinal.fatores) {
      if (f.contribuicao === 0) continue
      if (!atrib[f.nome]) atrib[f.nome] = { acertos: 0, total: 0 }
      atrib[f.nome].total++
      const fatorAcertou = f.contribuicao > 0 ? variacaoPct > 0 : variacaoPct < 0
      if (fatorAcertou) atrib[f.nome].acertos++
    }

    detalhe.push({
      mes: ponto.mes,
      rec: sinal.recomendacao,
      precoNoMes: ponto.precoFisico,
      precoFuturo: futuro.precoFisico,
      variacaoPct,
      acertou,
    })
  }

  const totalSinais = detalhe.length
  const taxaAcerto = totalSinais > 0 ? (acertos / totalSinais) * 100 : 0
  const retornoMedioSinal = totalSinais > 0 ? somaRetSinal / totalSinais : 0
  const retornoBaseline = totalSinais > 0 ? somaRetBaseline / totalSinais : 0

  // Atribuição: apenas os fatores efetivamente ativos.
  const porFator: AtribuicaoFator[] = [...fatoresAtivos].map((nome) => {
    const a = atrib[nome] ?? { acertos: 0, total: 0 }
    return {
      nome,
      acertos: a.acertos,
      total: a.total,
      taxaAcerto: a.total > 0 ? (a.acertos / a.total) * 100 : 0,
    }
  })

  return {
    grao: '',
    horizonteMeses: H,
    totalSinais,
    acertos,
    taxaAcerto,
    retornoMedioSinal,
    retornoBaseline,
    ganhoVsBaseline: retornoMedioSinal - retornoBaseline,
    porFator,
    detalhe,
  }
}

// ── powerset (PURA, testável) ────────────────────────────────────────────────

/**
 * Powerset (conjunto das partes) de `fatores`, EXCLUINDO o conjunto vazio.
 * Para n fatores retorna 2^n − 1 subconjuntos. Determinístico: a ordem dos
 * elementos de cada subconjunto preserva a ordem do array de entrada.
 *
 * Limita a 6 fatores (63 combos) para manter o custo do grid search controlado;
 * acima disso lança (decisão explícita do desenvolvedor, não best-effort).
 */
export function powerset(fatores: string[]): string[][] {
  const n = fatores.length
  if (n > 6) {
    throw new Error(`powerset: máximo 6 fatores (recebeu ${n}) — explosão combinatória`)
  }
  const out: string[][] = []
  const total = 1 << n // 2^n
  for (let mascara = 1; mascara < total; mascara++) {
    const sub: string[] = []
    for (let bit = 0; bit < n; bit++) {
      if (mascara & (1 << bit)) sub.push(fatores[bit])
    }
    out.push(sub)
  }
  return out
}

// ── gridSearchWalkForward (⭐) ────────────────────────────────────────────────

export interface OptsGridSearch {
  /** Horizontes (meses à frente) a testar. */
  horizontes: number[]
  /**
   * Combinações de fatores a testar. Se vazio/ausente, usa powerset(FATORES_V2).
   * Cada combo é um array de nomes de fatores.
   */
  combosFatores?: string[][]
  /** Tamanho da janela de TREINO (meses) usada para calibrar os padrões sazonais. */
  janelaTreino: number
}

export interface ConfigGrid {
  horizonte: number
  fatores: string[]
  taxaAcertoOOS: number
  retornoOOS: number
  ganhoVsBaseline: number
}

export interface RankingItem {
  horizonte: number
  fatores: string
  taxaAcertoOOS: number
  retornoOOS: number
}

export interface ResultadoGridSearch {
  melhor: ConfigGrid
  ranking: RankingItem[]
  totalCombos: number
}

/**
 * Resultado OOS acumulado de uma config (somatórios para média ponderada por
 * número de sinais entre as janelas deslizantes).
 */
interface AcumuladorOOS {
  acertos: number
  totalSinais: number
  somaRetSinal: number
  somaRetBaseline: number
}

/**
 * ⭐ Grid search EXAUSTIVO com WALK-FORWARD. Para CADA combinação de
 * (horizonte × subconjunto de fatores):
 *
 *  1. Desliza uma janela: treina nos `janelaTreino` meses iniciais (calibra os
 *     padrões sazonais via retornoMedioPorMes IN-SAMPLE) e TESTA no bloco
 *     seguinte (OUT-OF-SAMPLE), depois avança a janela de treino para incluir
 *     o bloco testado, e repete. Isso evita overfit: a métrica reportada é
 *     SEMPRE out-of-sample.
 *  2. Acumula acerto e retorno OOS de todas as janelas.
 *
 * Retorna a melhor config OOS (maior taxa de acerto; desempate por ganho vs
 * baseline) + ranking completo ordenado.
 *
 * Os combos vêm de `combosFatores` ou, se ausente, de powerset(FATORES_V2)
 * (63 combos). PURA: não faz fetch nem usa relógio.
 */
export function gridSearchWalkForward(
  serie: PontoSerieV2[],
  opts: OptsGridSearch,
): ResultadoGridSearch {
  const horizontes = opts.horizontes.length > 0 ? opts.horizontes : [1, 2, 3]
  const combos =
    opts.combosFatores && opts.combosFatores.length > 0
      ? opts.combosFatores.filter((c) => c.length > 0)
      : powerset([...FATORES_V2])
  const janelaTreino = Math.max(1, Math.floor(opts.janelaTreino))

  const configs: ConfigGrid[] = []

  for (const h of horizontes) {
    const H = Math.max(1, Math.floor(h))
    for (const combo of combos) {
      const ativos = new Set(combo)
      const acc = avaliarWalkForward(serie, H, ativos, janelaTreino)
      if (acc.totalSinais === 0) continue

      const taxaAcertoOOS = (acc.acertos / acc.totalSinais) * 100
      const retornoOOS = acc.somaRetSinal / acc.totalSinais
      const retBaseline = acc.somaRetBaseline / acc.totalSinais

      configs.push({
        horizonte: H,
        fatores: combo.slice(),
        taxaAcertoOOS,
        retornoOOS,
        ganhoVsBaseline: retornoOOS - retBaseline,
      })
    }
  }

  // Ordena: maior taxa OOS; desempate por maior retorno OOS, depois menos fatores.
  configs.sort(ordenarConfigs)

  const melhor: ConfigGrid =
    configs.length > 0
      ? configs[0]
      : { horizonte: horizontes[0], fatores: [], taxaAcertoOOS: 0, retornoOOS: 0, ganhoVsBaseline: 0 }

  const ranking: RankingItem[] = configs.map((c) => ({
    horizonte: c.horizonte,
    fatores: c.fatores.join('+'),
    taxaAcertoOOS: c.taxaAcertoOOS,
    retornoOOS: c.retornoOOS,
  }))

  return { melhor, ranking, totalCombos: configs.length }
}

/** Critério de ordenação das configs (maior é melhor). Função nomeada. */
function ordenarConfigs(a: ConfigGrid, b: ConfigGrid): number {
  if (b.taxaAcertoOOS !== a.taxaAcertoOOS) return b.taxaAcertoOOS - a.taxaAcertoOOS
  if (b.retornoOOS !== a.retornoOOS) return b.retornoOOS - a.retornoOOS
  return a.fatores.length - b.fatores.length
}

/**
 * Walk-forward para UMA config: desliza a janela de treino, calibra os padrões
 * sazonais IN-SAMPLE (no treino) e mede acerto/retorno OUT-OF-SAMPLE no bloco
 * de teste seguinte. Acumula em todas as janelas. Função nomeada (testável
 * indiretamente por gridSearchWalkForward).
 *
 * Esquema (janelaTreino=T, horizonte=H): a 1ª janela treina serie[0..T) e testa
 * serie[T..). Como cada sinal OOS precisa de H meses de futuro, só pontos com
 * i+H < len são avaliados. A janela de treino cresce expandindo (anchored
 * walk-forward) — robusto p/ séries curtas.
 */
function avaliarWalkForward(
  serie: PontoSerieV2[],
  H: number,
  fatoresAtivos: Set<string>,
  janelaTreino: number,
): AcumuladorOOS {
  const acc: AcumuladorOOS = { acertos: 0, totalSinais: 0, somaRetSinal: 0, somaRetBaseline: 0 }
  const n = serie.length
  // Sem dados suficientes p/ treino + ao menos 1 ponto OOS com futuro.
  if (n < janelaTreino + H + 1) return acc

  const usaSazonal = fatoresAtivos.has('sazonal')

  // Bloco de teste OOS: começa logo após o treino e vai até o fim.
  // Treino expande (anchored): para o ponto OOS i, treina em serie[0..i) — só
  // informação ANTERIOR ao ponto avaliado (sem vazar futuro nem o próprio mês).
  for (let i = janelaTreino; i + H < n; i++) {
    const ponto = serie[i]
    const futuro = serie[i + H]

    // Padrões sazonais calibrados SÓ com o passado (treino in-sample = serie[0..i)).
    let padroes: Record<number, number> | undefined
    if (usaSazonal) {
      padroes = retornoMedioPorMes(serie.slice(0, i), H)
    }

    const inicio = Math.max(0, i - JANELA_MEDIA)
    const janelaMM = serie.slice(inicio, i)
    const mediaMovel =
      janelaMM.length > 0
        ? janelaMM.reduce((s, p) => s + p.precoFisico, 0) / janelaMM.length
        : null

    const mesCal = ponto.mesCalendario ?? mesCalendarioDe(ponto.mes)

    const sinal = gerarSinalV2(
      {
        mes: ponto.mes,
        precoFisico: ponto.precoFisico,
        mediaMovel,
        cbot: ponto.cbot,
        cbotAnterior: i > 0 ? serie[i - 1].cbot : null,
        cbot3mAtras: i >= 3 ? serie[i - 3].cbot : null,
        cambio: ponto.cambio,
        mesCalendario: mesCal,
        cotZScore: ponto.cotZScore ?? null,
        carryPct: ponto.carryPct ?? null,
        surpresaEstoque: ponto.surpresaEstoque ?? null,
        padroesSazonais: padroes,
      },
      fatoresAtivos,
    )

    const variacaoPct =
      ponto.precoFisico > 0
        ? ((futuro.precoFisico - ponto.precoFisico) / ponto.precoFisico) * 100
        : 0

    acc.totalSinais++
    if (sinalAcertou(sinal.recomendacao, variacaoPct)) acc.acertos++
    acc.somaRetSinal += retornoDoSinal(sinal.recomendacao, variacaoPct)
    acc.somaRetBaseline += retornoDoSinal('vender', variacaoPct)
  }

  return acc
}
