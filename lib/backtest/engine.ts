/**
 * lib/backtest/engine.ts
 *
 * Motor PURO de backtest da inteligência de mercado. Recebe as séries
 * históricas JÁ alinhadas por mês (preço físico BR, CBOT, câmbio, dólar
 * projetado Focus, estoque USDA) e, para cada mês, RECONSTRÓI o sinal que a
 * inteligência teria dado com a informação disponível ATÉ aquele mês —
 * recomendando VENDER / SEGURAR / ESPERAR — e o compara com o que o preço
 * físico fez nos H meses seguintes (gabarito).
 *
 * NÃO faz fetch. NÃO usa data/hora do sistema: tudo entra por parâmetro,
 * tornando o motor 100% determinístico e testável (modelo agregador.ts).
 *
 * Convenção de acerto (gabarito = preço físico futuro):
 *  - 'vender'  acerta se o preço CAIU (foi bom ter vendido antes da queda).
 *  - 'segurar' / 'esperar' acertam se o preço SUBIU (valeu a pena esperar).
 *
 * Regras dos sinais (explicáveis, com pesos calibráveis):
 *  - PREÇO vs média móvel: preço bem acima da média → propenso a cair → vender.
 *  - DÓLAR projetado vs câmbio atual: dólar projetado SUBINDO sustenta preço em
 *    R$ → segurar/esperar; descendo → vender.
 *  - CBOT (tendência internacional): CBOT subindo puxa o físico → esperar;
 *    caindo → vender.
 *  - ESTOQUE USDA: estoque SUBINDO (mais oferta) é baixista → vender; caindo
 *    → esperar.
 */

export type Recomendacao = 'vender' | 'segurar' | 'esperar'

/** Nomes canônicos dos fatores (chaves de peso e de atribuição). */
export const FATORES = ['preco_vs_media', 'dolar_proj', 'cbot_tendencia', 'estoque_usda'] as const
export type NomeFator = (typeof FATORES)[number]

/** Pesos padrão de cada fator (antes da calibração). */
export const PESOS_PADRAO: Record<NomeFator, number> = {
  preco_vs_media: 1,
  dolar_proj: 1,
  cbot_tendencia: 1,
  estoque_usda: 1,
}

/**
 * Limiar (em fração, ex.: 0.02 = 2%) abaixo do qual uma variação é
 * considerada irrelevante (não gera contribuição de fator).
 */
export const LIMIAR_RELEVANCIA = 0.02

/**
 * Limiar do |score| agregado para emitir uma recomendação direcional.
 * Score positivo → 'esperar'/'segurar' (preço deve subir); negativo →
 * 'vender'. Dentro da banda morta → 'segurar' (neutro / manter posição).
 */
export const LIMIAR_DECISAO = 0.5

export interface FatorContribuicao {
  nome: string
  contribuicao: number
}

export interface SinalHistorico {
  /** 'YYYY-MM'. */
  mes: string
  recomendacao: Recomendacao
  /** Score agregado: >0 tende a subir (esperar), <0 tende a cair (vender). */
  score: number
  fatores: FatorContribuicao[]
}

/** Um ponto mensal da série já alinhada. */
export interface PontoSerie {
  /** 'YYYY-MM'. */
  mes: string
  /** Preço físico BR em R$/saca (gabarito). */
  precoFisico: number
  /** CBOT (cents/bushel) — tendência internacional. */
  cbot: number
  /** Câmbio à vista (USD/BRL) no mês. */
  cambio: number
  /** Dólar projetado (Focus) na época — opcional. */
  dolarProj?: number
  /** Estoque final USDA (Mt) conhecido na época — opcional. */
  estoqueUsda?: number
}

export interface DetalheBacktest {
  mes: string
  rec: Recomendacao
  precoNoMes: number
  precoFuturo: number
  /** Variação % do preço físico do mês para H meses à frente. */
  variacaoPct: number
  acertou: boolean
}

export interface AtribuicaoFator {
  nome: string
  acertos: number
  total: number
  taxaAcerto: number
}

export interface ResultadoBacktest {
  grao: string
  horizonteMeses: number
  totalSinais: number
  acertos: number
  taxaAcerto: number
  /** Retorno médio (%) capturado seguindo o sinal (ver `retornoDoSinal`). */
  retornoMedioSinal: number
  /** Retorno médio (%) da estratégia ingênua de vender todo mês. */
  retornoBaseline: number
  /** retornoMedioSinal − retornoBaseline (ganho em pontos percentuais). */
  ganhoVsBaseline: number
  porFator: AtribuicaoFator[]
  detalhe: DetalheBacktest[]
}

// ── Contexto para gerarSinal ────────────────────────────────────────────────

/**
 * Contexto de UM mês usado por `gerarSinal`. Já vem com a média móvel do preço
 * calculada pelo caller (rodarBacktest passa a média dos meses anteriores).
 */
export interface ContextoSinal {
  mes: string
  precoFisico: number
  /** Média móvel do preço físico (janela anterior). Null se insuficiente. */
  mediaMovel: number | null
  cbot: number
  /** CBOT anterior (mês anterior) para tendência. Null se primeiro ponto. */
  cbotAnterior: number | null
  cambio: number
  dolarProj?: number
  estoqueUsda?: number
  /** Estoque USDA do ponto anterior (tendência). Null se ausente. */
  estoqueUsdaAnterior?: number | null
  /** Pesos por fator (default PESOS_PADRAO). */
  pesos?: Record<string, number>
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Variação relativa (fração) de `atual` sobre `base`. Null se inválido. */
function variacaoRel(
  atual: number | null | undefined,
  base: number | null | undefined,
): number | null {
  if (
    atual === null ||
    atual === undefined ||
    base === null ||
    base === undefined ||
    base === 0
  ) {
    return null
  }
  return (atual - base) / base
}

/** Aplica a banda morta de relevância: variações pequenas viram 0. */
function comRelevancia(v: number | null): number {
  if (v === null) return 0
  return Math.abs(v) < LIMIAR_RELEVANCIA ? 0 : v
}

function pesoDe(pesos: Record<string, number> | undefined, nome: NomeFator): number {
  const p = pesos?.[nome]
  if (p === undefined || p === null || Number.isNaN(p)) return PESOS_PADRAO[nome]
  return p
}

// ── gerarSinal ──────────────────────────────────────────────────────────────

/**
 * Dado o contexto de UM mês, decide vender/segurar/esperar com score e
 * fatores explicáveis. Cada fator contribui com `peso * direcao` onde direcao
 * ∈ [-1, +1]:
 *  - contribuição POSITIVA empurra para "esperar/segurar" (preço deve subir).
 *  - contribuição NEGATIVA empurra para "vender" (preço deve cair).
 *
 * Direção por fator:
 *  - preco_vs_media: preço ACIMA da média → negativa (propenso a corrigir p/
 *    baixo → vender). Abaixo da média → positiva (barganha, tende a subir).
 *  - dolar_proj: dólar projetado SUBINDO sobre câmbio atual → positiva
 *    (sustenta preço em R$ → esperar). Descendo → negativa.
 *  - cbot_tendencia: CBOT subindo → positiva (puxa físico → esperar). Caindo
 *    → negativa.
 *  - estoque_usda: estoque SUBINDO (mais oferta) → negativa (baixista →
 *    vender). Caindo → positiva.
 */
export function gerarSinal(contexto: ContextoSinal): SinalHistorico {
  const { pesos } = contexto
  const fatores: FatorContribuicao[] = []

  // 1) Preço vs média móvel — sinal CONTRARIAN limitado a ±1.
  if (contexto.mediaMovel !== null && contexto.mediaMovel > 0) {
    const desvio = (contexto.precoFisico - contexto.mediaMovel) / contexto.mediaMovel
    const rel = comRelevancia(desvio)
    if (rel !== 0) {
      // acima da média → contribuição negativa (vender). Clamp em ±1.
      const direcao = Math.max(-1, Math.min(1, -rel / 0.1))
      fatores.push({
        nome: 'preco_vs_media',
        contribuicao: pesoDe(pesos, 'preco_vs_media') * direcao,
      })
    }
  }

  // 2) Dólar projetado vs câmbio atual.
  if (contexto.dolarProj !== undefined && contexto.dolarProj !== null) {
    const v = comRelevancia(variacaoRel(contexto.dolarProj, contexto.cambio))
    if (v !== 0) {
      const direcao = Math.max(-1, Math.min(1, v / 0.05))
      fatores.push({
        nome: 'dolar_proj',
        contribuicao: pesoDe(pesos, 'dolar_proj') * direcao,
      })
    }
  }

  // 3) CBOT tendência (mês atual vs anterior).
  if (contexto.cbotAnterior !== null && contexto.cbotAnterior !== undefined) {
    const v = comRelevancia(variacaoRel(contexto.cbot, contexto.cbotAnterior))
    if (v !== 0) {
      const direcao = Math.max(-1, Math.min(1, v / 0.05))
      fatores.push({
        nome: 'cbot_tendencia',
        contribuicao: pesoDe(pesos, 'cbot_tendencia') * direcao,
      })
    }
  }

  // 4) Estoque USDA tendência (subir = baixista = negativo).
  if (
    contexto.estoqueUsda !== undefined &&
    contexto.estoqueUsda !== null &&
    contexto.estoqueUsdaAnterior !== undefined &&
    contexto.estoqueUsdaAnterior !== null
  ) {
    const v = comRelevancia(variacaoRel(contexto.estoqueUsda, contexto.estoqueUsdaAnterior))
    if (v !== 0) {
      // estoque subindo (v>0) → baixista → contribuição negativa.
      const direcao = Math.max(-1, Math.min(1, -v / 0.05))
      fatores.push({
        nome: 'estoque_usda',
        contribuicao: pesoDe(pesos, 'estoque_usda') * direcao,
      })
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

// ── rodarBacktest ───────────────────────────────────────────────────────────

/** Janela da média móvel do preço (meses anteriores). */
export const JANELA_MEDIA = 6

/**
 * Retorno (%) capturado por uma recomendação dado o movimento futuro do preço.
 * 'vender' captura o INVERSO da variação (lucra quando o preço cai depois);
 * 'segurar'/'esperar' capturam a variação direta (lucra quando sobe).
 */
export function retornoDoSinal(rec: Recomendacao, variacaoPct: number): number {
  if (rec === 'vender') return -variacaoPct
  return variacaoPct
}

/** Um sinal acertou? 'vender' acerta com queda; segurar/esperar com alta. */
export function sinalAcertou(rec: Recomendacao, variacaoPct: number): boolean {
  if (rec === 'vender') return variacaoPct < 0
  // segurar/esperar: acerta se subiu (>= 0 conta como acerto fraco para
  // segurar; usamos > 0 estrito para alta real).
  return variacaoPct > 0
}

/**
 * Roda o backtest sobre a série alinhada. Para cada mês com H meses de futuro
 * disponíveis, gera o sinal (com info até aquele mês) e compara com o preço
 * físico H meses à frente. Calcula taxa de acerto, retorno médio do sinal vs
 * baseline (vender todo mês) e atribuição por fator.
 */
export function rodarBacktest(
  serie: PontoSerie[],
  opts: { horizonteMeses: number; pesos?: Record<string, number> },
): ResultadoBacktest {
  const { horizonteMeses, pesos } = opts
  const H = Math.max(1, Math.floor(horizonteMeses))
  const grao = '' // o caller define o rótulo; mantido vazio se não informado.

  const detalhe: DetalheBacktest[] = []
  const atrib: Record<string, { acertos: number; total: number }> = {}

  let somaRetSinal = 0
  let somaRetBaseline = 0
  let acertos = 0

  for (let i = 0; i + H < serie.length; i++) {
    const ponto = serie[i]
    const futuro = serie[i + H]

    // Média móvel dos JANELA_MEDIA meses anteriores (exclui o mês atual).
    const inicio = Math.max(0, i - JANELA_MEDIA)
    const janela = serie.slice(inicio, i)
    const mediaMovel =
      janela.length > 0
        ? janela.reduce((acc, p) => acc + p.precoFisico, 0) / janela.length
        : null

    const sinal = gerarSinal({
      mes: ponto.mes,
      precoFisico: ponto.precoFisico,
      mediaMovel,
      cbot: ponto.cbot,
      cbotAnterior: i > 0 ? serie[i - 1].cbot : null,
      cambio: ponto.cambio,
      dolarProj: ponto.dolarProj,
      estoqueUsda: ponto.estoqueUsda,
      estoqueUsdaAnterior: i > 0 ? (serie[i - 1].estoqueUsda ?? null) : null,
      pesos,
    })

    const variacaoPct =
      ponto.precoFisico > 0
        ? ((futuro.precoFisico - ponto.precoFisico) / ponto.precoFisico) * 100
        : 0

    const acertou = sinalAcertou(sinal.recomendacao, variacaoPct)
    if (acertou) acertos++

    somaRetSinal += retornoDoSinal(sinal.recomendacao, variacaoPct)
    // baseline: vender todo mês → captura -variacaoPct sempre.
    somaRetBaseline += retornoDoSinal('vender', variacaoPct)

    // Atribuição: cada fator com contribuição relevante "vota" na direção do
    // sinal. Conta acerto do fator se a direção dele bate com o resultado.
    for (const f of sinal.fatores) {
      if (f.contribuicao === 0) continue
      if (!atrib[f.nome]) atrib[f.nome] = { acertos: 0, total: 0 }
      atrib[f.nome].total++
      // fator positivo "aposta" em alta; negativo aposta em queda.
      const fatorAcertou =
        f.contribuicao > 0 ? variacaoPct > 0 : variacaoPct < 0
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

  const porFator: AtribuicaoFator[] = FATORES.map((nome) => {
    const a = atrib[nome] ?? { acertos: 0, total: 0 }
    return {
      nome,
      acertos: a.acertos,
      total: a.total,
      taxaAcerto: a.total > 0 ? (a.acertos / a.total) * 100 : 0,
    }
  })

  return {
    grao,
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

// ── calibrarPesos ───────────────────────────────────────────────────────────

/**
 * Grid search leve: testa combinações simples de pesos por fator × horizontes
 * e retorna a combinação com maior taxa de acerto. Os pesos testados por fator
 * vêm de um pequeno conjunto discreto para manter o custo baixo.
 */
export function calibrarPesos(
  serie: PontoSerie[],
  horizontes: number[],
): { pesos: Record<string, number>; melhorHorizonte: number; taxaAcertoCalibrada: number } {
  const valores = [0, 0.5, 1, 1.5, 2]
  const hs = horizontes.length > 0 ? horizontes : [1, 2, 3]

  let melhorPesos: Record<string, number> = { ...PESOS_PADRAO }
  let melhorHorizonte = hs[0]
  let melhorTaxa = -1
  let melhorGanho = -Infinity

  for (const h of hs) {
    for (const wPreco of valores) {
      for (const wDolar of valores) {
        for (const wCbot of valores) {
          for (const wEstoque of valores) {
            // evita o caso degenerado de todos os pesos zerados.
            if (wPreco + wDolar + wCbot + wEstoque === 0) continue
            const pesos: Record<string, number> = {
              preco_vs_media: wPreco,
              dolar_proj: wDolar,
              cbot_tendencia: wCbot,
              estoque_usda: wEstoque,
            }
            const r = rodarBacktest(serie, { horizonteMeses: h, pesos })
            if (r.totalSinais === 0) continue
            // critério: maior taxa de acerto; desempate por ganho vs baseline.
            if (
              r.taxaAcerto > melhorTaxa ||
              (r.taxaAcerto === melhorTaxa && r.ganhoVsBaseline > melhorGanho)
            ) {
              melhorTaxa = r.taxaAcerto
              melhorGanho = r.ganhoVsBaseline
              melhorPesos = pesos
              melhorHorizonte = h
            }
          }
        }
      }
    }
  }

  return {
    pesos: melhorPesos,
    melhorHorizonte,
    taxaAcertoCalibrada: melhorTaxa < 0 ? 0 : melhorTaxa,
  }
}
