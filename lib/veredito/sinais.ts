/**
 * lib/veredito/sinais.ts
 *
 * O CORAÇÃO do produto BH Intelligence: os 3 sinais independentes + o veredito
 * por voto majoritário. Biblioteca 100% PURA — NÃO faz fetch, recebe a série de
 * preço físico (R$/saca) + CBOT (¢/bushel) já montada e alinhada por mês.
 * Determinística e testável (modelo lib/backtest/sazonalidade.test.ts).
 *
 * POSICIONAMENTO HONESTO (sem alucinação): o teto comprovado da DIREÇÃO é
 * ~55-60%. O edge real é modesto (+5 a +6pp sobre jogar moeda), mas consistente
 * e auditável em 25 anos. NÃO existe "75% de acerto" nem "previsão garantida".
 * Cada sinal expõe sua taxa histórica real e o ganho vs acaso (50%).
 *
 * Os 3 ângulos independentes (regras EXPLICÁVEIS, fundamentadas na literatura):
 *  1. SAZONAL        — retorno médio histórico do mês calendário (farmdoc/CME:
 *                      colheita = fundo). É o sinal mais forte.
 *  2. MEAN-REVERSION — preço atual vs média móvel 12m (Wisconsin: basis reverte).
 *  3. MOMENTUM       — variação do CBOT nos últimos 6m (tendência continua).
 *
 * VEREDITO: voto majoritário dos 3 (vender/segurar/neutro). A concordância
 * (3/3, 2/3) vira CONFIANÇA — concordância maior = mais convicção, mas a taxa
 * não dispara (mostrar a real). Horizonte padrão H=2 meses.
 */

/** Direção de um sinal. 'neutro' = sem viés acionável. */
export type DirecaoSinal = 'vender' | 'segurar' | 'neutro'

/** Um ponto da série já montada: preço físico (R$/saca) + CBOT (¢/bushel). */
export interface PontoVeredito {
  ano: number
  mes: number
  preco: number
  cbot: number
}

/** Resultado de um único sinal para um mês específico. */
export interface ResultadoSinal {
  nome: 'sazonal' | 'mean_reversion' | 'momentum'
  direcao: DirecaoSinal
  /** Explicação em 1 linha do PORQUÊ da recomendação atual. */
  motivo: string
  /** Taxa histórica de acerto de direção deste sinal (0-100). */
  taxaHistorica: number
  /** Ganho vs acaso = taxaHistorica - 50 (pode ser negativo). */
  ganhoVsAcaso: number
}

/** Veredito agregado: voto majoritário + nível de concordância/confiança. */
export interface Veredito {
  sinais: ResultadoSinal[]
  direcao: DirecaoSinal
  /** Quantos sinais concordam com a direção vencedora (0-3). */
  concordancia: number
  /** Confiança derivada da concordância. */
  confianca: 'alta' | 'media' | 'baixa'
  /** Taxa histórica do veredito (0-100). */
  taxaHistorica: number
  /** Ganho vs acaso do veredito = taxaHistorica - 50. */
  ganhoVsAcaso: number
  /** Frase-resumo de copiloto, honesta. */
  resumo: string
}

// ── Limiares das regras (calibrados pela literatura/calibração comprovada) ────

/** Sazonal: ±5% de retorno médio satura o viés (mesma escala de sazonalidade.ts). */
export const NORMALIZADOR_SAZONAL = 0.05
/** Sazonal: retorno médio com |valor| < este limiar → neutro (ruído). */
const SAZONAL_ZONA_NEUTRA = 0.005
/** Mean-reversion: desvio vs média 12m que aciona o sinal (±6%). */
const MR_LIMIAR = 0.06
/** Momentum: variação do CBOT em 6m que aciona o sinal (±4%). */
const MOM_LIMIAR = 0.04
/** Janela da média móvel do mean-reversion (meses). */
const MR_JANELA = 12
/** Janela do momentum do CBOT (meses). */
const MOM_JANELA = 6
/** Horizonte padrão de avaliação (meses à frente). */
export const HORIZONTE_PADRAO = 2

// ── Helpers internos ──────────────────────────────────────────────────────────

function pct(x: number, casas = 1): string {
  return `${(x * 100).toFixed(casas)}%`
}

function arredonda(x: number, casas = 1): number {
  const f = 10 ** casas
  return Math.round(x * f) / f
}

/**
 * PURA: para cada mês calendário (1-12), o RETORNO MÉDIO histórico do preço
 * físico nos H meses seguintes (fração). Aprende o padrão da PRÓPRIA série.
 * Meses sem observação NÃO entram no Record (não inventa dado). Defensivo:
 * ignora preços não finitos ou zero como origem; nunca lança.
 */
export function aprenderSazonalidade(
  serie: PontoVeredito[],
  H: number,
): Record<number, number> {
  const h = Math.max(1, Math.floor(H))
  const soma: Record<number, number> = {}
  const cont: Record<number, number> = {}

  for (let i = 0; i + h < serie.length; i++) {
    const ponto = serie[i]
    const futuro = serie[i + h]
    const cal = ponto?.mes
    if (!Number.isInteger(cal) || cal < 1 || cal > 12) continue
    if (!Number.isFinite(ponto.preco) || ponto.preco === 0) continue
    if (!Number.isFinite(futuro.preco)) continue

    const ret = (futuro.preco - ponto.preco) / ponto.preco
    if (!Number.isFinite(ret)) continue
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

// ── Núcleo de cada sinal (apenas a DIREÇÃO, sem taxas) ────────────────────────

/** Núcleo do sazonal: direção + motivo a partir do padrão do mês. */
function nucleoSazonal(
  serie: PontoVeredito[],
  i: number,
  padroes: Record<number, number>,
): { direcao: DirecaoSinal; motivo: string } {
  const ponto = serie[i]
  const cal = ponto?.mes
  const ret = Number.isInteger(cal) ? padroes[cal] : undefined
  if (ret === undefined || ret === null || !Number.isFinite(ret)) {
    return { direcao: 'neutro', motivo: 'Sem padrão sazonal histórico para este mês.' }
  }
  if (Math.abs(ret) < SAZONAL_ZONA_NEUTRA) {
    return {
      direcao: 'neutro',
      motivo: `Mês historicamente neutro (retorno médio ${pct(ret)} à frente).`,
    }
  }
  if (ret < 0) {
    return {
      direcao: 'vender',
      motivo: `Mês historicamente de queda: preço caiu em média ${pct(ret)} à frente.`,
    }
  }
  return {
    direcao: 'segurar',
    motivo: `Mês historicamente de alta: preço subiu em média ${pct(ret)} à frente.`,
  }
}

/** Núcleo do mean-reversion: preço atual vs média móvel 12m. */
function nucleoMeanReversion(
  serie: PontoVeredito[],
  i: number,
): { direcao: DirecaoSinal; motivo: string } {
  if (i < MR_JANELA) {
    return { direcao: 'neutro', motivo: 'Histórico insuficiente para média móvel de 12m.' }
  }
  let soma = 0
  let n = 0
  for (let j = i - MR_JANELA; j < i; j++) {
    const p = serie[j]?.preco
    if (Number.isFinite(p)) {
      soma += p
      n++
    }
  }
  const atual = serie[i]?.preco
  if (n === 0 || soma === 0 || !Number.isFinite(atual)) {
    return { direcao: 'neutro', motivo: 'Dados insuficientes para média móvel de 12m.' }
  }
  const media = soma / n
  if (media === 0) {
    return { direcao: 'neutro', motivo: 'Média móvel inválida.' }
  }
  const dv = (atual - media) / media
  if (dv > MR_LIMIAR) {
    return {
      direcao: 'vender',
      motivo: `Preço ${pct(dv)} acima da média de 12m — tende a reverter para baixo.`,
    }
  }
  if (dv < -MR_LIMIAR) {
    return {
      direcao: 'segurar',
      motivo: `Preço ${pct(dv)} abaixo da média de 12m — tende a reverter para cima.`,
    }
  }
  return {
    direcao: 'neutro',
    motivo: `Preço perto da média de 12m (${pct(dv)}) — sem desvio acionável.`,
  }
}

/** Núcleo do momentum: variação do CBOT nos últimos 6m. */
function nucleoMomentum(
  serie: PontoVeredito[],
  i: number,
): { direcao: DirecaoSinal; motivo: string } {
  if (i < MOM_JANELA) {
    return { direcao: 'neutro', motivo: 'Histórico insuficiente para momentum de 6m.' }
  }
  const antes = serie[i - MOM_JANELA]?.cbot
  const atual = serie[i]?.cbot
  if (!Number.isFinite(antes) || antes === 0 || !Number.isFinite(atual)) {
    return { direcao: 'neutro', motivo: 'CBOT indisponível para o cálculo de momentum.' }
  }
  const variacao = (atual - antes) / antes
  if (variacao > MOM_LIMIAR) {
    return {
      direcao: 'segurar',
      motivo: `CBOT em tendência de alta (${pct(variacao)} em 6m) — tende a continuar.`,
    }
  }
  if (variacao < -MOM_LIMIAR) {
    return {
      direcao: 'vender',
      motivo: `CBOT em tendência de baixa (${pct(variacao)} em 6m) — pressão continua.`,
    }
  }
  return {
    direcao: 'neutro',
    motivo: `CBOT lateral (${pct(variacao)} em 6m) — sem tendência clara.`,
  }
}

// ── API pública de cada sinal (com taxas) ─────────────────────────────────────

type TaxaInfo = { taxa: number; ganho: number; n: number }
type Taxas = Record<string, TaxaInfo>

function taxaDe(taxas: Taxas | undefined, nome: string): { taxaHistorica: number; ganhoVsAcaso: number } {
  const t = taxas?.[nome]
  if (t && Number.isFinite(t.taxa)) {
    return { taxaHistorica: t.taxa, ganhoVsAcaso: arredonda(t.taxa - 50) }
  }
  return { taxaHistorica: 0, ganhoVsAcaso: 0 }
}

/** SAZONAL: usa o padrão do mês de serie[i]. */
export function sinalSazonal(
  serie: PontoVeredito[],
  i: number,
  padroes: Record<number, number>,
  _H?: number,
  taxas?: Taxas,
): ResultadoSinal {
  const { direcao, motivo } = nucleoSazonal(serie, i, padroes)
  const { taxaHistorica, ganhoVsAcaso } = taxaDe(taxas, 'sazonal')
  return { nome: 'sazonal', direcao, motivo, taxaHistorica, ganhoVsAcaso }
}

/** MEAN-REVERSION: preço vs média móvel 12m. */
export function sinalMeanReversion(
  serie: PontoVeredito[],
  i: number,
  taxas?: Taxas,
): ResultadoSinal {
  const { direcao, motivo } = nucleoMeanReversion(serie, i)
  const { taxaHistorica, ganhoVsAcaso } = taxaDe(taxas, 'mean_reversion')
  return { nome: 'mean_reversion', direcao, motivo, taxaHistorica, ganhoVsAcaso }
}

/** MOMENTUM: variação do CBOT nos últimos 6m. */
export function sinalMomentum(
  serie: PontoVeredito[],
  i: number,
  taxas?: Taxas,
): ResultadoSinal {
  const { direcao, motivo } = nucleoMomentum(serie, i)
  const { taxaHistorica, ganhoVsAcaso } = taxaDe(taxas, 'momentum')
  return { nome: 'momentum', direcao, motivo, taxaHistorica, ganhoVsAcaso }
}

// ── Voto majoritário ──────────────────────────────────────────────────────────

/**
 * Voto majoritário entre vender/segurar (ignora neutros na contagem).
 * Empate ou nenhum voto acionável → neutro. Retorna a direção vencedora e
 * quantos dos sinais concordam com ela (concordância 0-3).
 */
function votar(direcoes: DirecaoSinal[]): { direcao: DirecaoSinal; concordancia: number } {
  let vender = 0
  let segurar = 0
  for (const d of direcoes) {
    if (d === 'vender') vender++
    else if (d === 'segurar') segurar++
  }
  if (vender > segurar) return { direcao: 'vender', concordancia: vender }
  if (segurar > vender) return { direcao: 'segurar', concordancia: segurar }
  // empate (inclui 0x0): neutro. Concordância = nº de sinais explicitamente neutros.
  const neutros = direcoes.filter((d) => d === 'neutro').length
  return { direcao: 'neutro', concordancia: neutros }
}

function confiancaDe(concordancia: number): 'alta' | 'media' | 'baixa' {
  if (concordancia >= 3) return 'alta'
  if (concordancia === 2) return 'media'
  return 'baixa'
}

/**
 * Gera os 3 sinais para o mês i e o veredito por voto majoritário.
 * `opts.padroes` permite reaproveitar a sazonalidade já aprendida (evita
 * recomputar); se ausente, aprende da própria série. `opts.taxas` injeta as
 * taxas históricas (de avaliarHistorico) em cada sinal/veredito.
 */
export function calcularVeredito(
  serie: PontoVeredito[],
  i: number,
  opts?: { H?: number; padroes?: Record<number, number>; taxas?: Taxas },
): Veredito {
  const H = opts?.H ?? HORIZONTE_PADRAO
  const padroes = opts?.padroes ?? aprenderSazonalidade(serie, H)
  const taxas = opts?.taxas

  const sinais: ResultadoSinal[] = [
    sinalSazonal(serie, i, padroes, H, taxas),
    sinalMeanReversion(serie, i, taxas),
    sinalMomentum(serie, i, taxas),
  ]

  const { direcao, concordancia } = votar(sinais.map((s) => s.direcao))
  const confianca = confiancaDe(concordancia)
  const vtx = taxaDe(taxas, 'veredito')

  const totalAcionaveis = sinais.filter((s) => s.direcao !== 'neutro').length
  const acao = direcao === 'vender' ? 'VENDER' : direcao === 'segurar' ? 'SEGURAR' : 'NEUTRO'
  const resumo =
    direcao === 'neutro'
      ? `Sinais divergentes ou sem viés claro — sem recomendação forte este mês.`
      : `${concordancia} de 3 ângulos apontam ${acao} (de ${totalAcionaveis} acionáveis).` +
        (vtx.taxaHistorica > 0
          ? ` Taxa histórica do veredito: ${vtx.taxaHistorica}% (${
              vtx.ganhoVsAcaso >= 0 ? '+' : ''
            }${vtx.ganhoVsAcaso}pp sobre o acaso).`
          : '')

  return {
    sinais,
    direcao,
    concordancia,
    confianca,
    taxaHistorica: vtx.taxaHistorica,
    ganhoVsAcaso: vtx.ganhoVsAcaso,
    resumo,
  }
}

// ── Avaliação histórica (full-sample, determinística) ─────────────────────────

/**
 * O resultado realizado do preço físico nos H meses à frente do índice i:
 * 'vender' se caiu, 'segurar' se subiu, null se não há futuro / dado inválido.
 */
function resultadoRealizado(serie: PontoVeredito[], i: number, H: number): DirecaoSinal | null {
  const fut = serie[i + H]
  const atual = serie[i]
  if (!fut || !Number.isFinite(fut.preco) || !Number.isFinite(atual?.preco) || atual.preco === 0) {
    return null
  }
  const ret = (fut.preco - atual.preco) / atual.preco
  if (!Number.isFinite(ret) || ret === 0) return null
  return ret < 0 ? 'vender' : 'segurar'
}

/**
 * Um sinal ACERTA quando sua direção acionável bate com o realizado. Sinais
 * neutros NÃO contam (nem acerto nem erro) — medimos só quando há aposta.
 */
function contabiliza(
  direcao: DirecaoSinal,
  realizado: DirecaoSinal | null,
  acc: { acertos: number; n: number },
): void {
  if (realizado === null || direcao === 'neutro') return
  acc.n++
  if (direcao === realizado) acc.acertos++
}

function finaliza(acc: { acertos: number; n: number }): TaxaInfo {
  const taxa = acc.n > 0 ? arredonda((acc.acertos / acc.n) * 100) : 0
  return { taxa, ganho: arredonda(taxa - 50), n: acc.n }
}

/**
 * FULL-SAMPLE: roda cada sinal em todos os meses elegíveis, mede a taxa de
 * acerto de DIREÇÃO real e o ganho vs acaso (50%). É a fonte de taxaHistorica /
 * ganhoVsAcaso. PURA e determinística. A sazonalidade usada é a aprendida da
 * própria série (full-sample) — alinhada à calibração de referência.
 */
export function avaliarHistorico(
  serie: PontoVeredito[],
  H: number,
): {
  porSinal: Record<string, TaxaInfo>
  veredito: TaxaInfo
} {
  const h = Math.max(1, Math.floor(H))
  const padroes = aprenderSazonalidade(serie, h)

  const accSaz = { acertos: 0, n: 0 }
  const accMr = { acertos: 0, n: 0 }
  const accMom = { acertos: 0, n: 0 }
  const accVer = { acertos: 0, n: 0 }

  for (let i = 0; i + h < serie.length; i++) {
    const realizado = resultadoRealizado(serie, i, h)
    if (realizado === null) continue

    const dSaz = nucleoSazonal(serie, i, padroes).direcao
    const dMr = nucleoMeanReversion(serie, i).direcao
    const dMom = nucleoMomentum(serie, i).direcao

    contabiliza(dSaz, realizado, accSaz)
    contabiliza(dMr, realizado, accMr)
    contabiliza(dMom, realizado, accMom)

    const { direcao } = votar([dSaz, dMr, dMom])
    contabiliza(direcao, realizado, accVer)
  }

  return {
    porSinal: {
      sazonal: finaliza(accSaz),
      mean_reversion: finaliza(accMr),
      momentum: finaliza(accMom),
    },
    veredito: finaliza(accVer),
  }
}

/**
 * Calcula o veredito AO VIVO para o ÚLTIMO mês da série, anexando as taxas
 * históricas reais (de avaliarHistorico). É o ponto de entrada do produto.
 * Defensivo: série vazia → veredito neutro sem taxas.
 */
export function vereditoAoVivo(serie: PontoVeredito[], H: number = HORIZONTE_PADRAO): Veredito {
  if (!Array.isArray(serie) || serie.length === 0) {
    return {
      sinais: [],
      direcao: 'neutro',
      concordancia: 0,
      confianca: 'baixa',
      taxaHistorica: 0,
      ganhoVsAcaso: 0,
      resumo: 'Sem dados suficientes para um veredito.',
    }
  }
  const h = Math.max(1, Math.floor(H))
  const padroes = aprenderSazonalidade(serie, h)
  const aval = avaliarHistorico(serie, h)
  const taxas: Taxas = { ...aval.porSinal, veredito: aval.veredito }
  return calcularVeredito(serie, serie.length - 1, { H: h, padroes, taxas })
}
