/**
 * lib/intel/agregador.ts
 *
 * Camada PURA que CONSOLIDA todas as fontes de inteligência (USDA PSD,
 * USDA Export Sales/ESR, Boletim Focus do BCB, CONAB safra brasileira,
 * dólar presente e curva de dólar futuro) num "panorama" único para um grão.
 *
 * NÃO faz fetch — recebe os dados já buscados por injeção, para ser 100%
 * testável e determinístico. Esta lib NÃO usa data/hora do sistema: o
 * `geradoEm` é recebido por parâmetro pelo caller.
 *
 * O panorama tem duas partes:
 *  - `fontes`: blocos formatados (rótulo/valor + variação/seta) por fonte
 *    presente. Fontes ausentes (undefined/null) são OMITIDAS.
 *  - `sinais`: leitura interpretativa do viés de mercado (altista/baixista/
 *    neutro) derivada das variações de cada fonte.
 *
 * Regras de viés (heurística de preço da commodity):
 *  - Estoque final SUBINDO → baixista (mais oferta disponível).
 *  - Produção/safra SUBINDO → baixista (mais oferta).
 *  - Exportações SUBINDO → altista (mais demanda).
 *  - Dólar projetado SUBINDO → altista para o preço em R$ (exportável vale
 *    mais em reais).
 */

export type Grao = 'soja' | 'milho'
export type Seta = 'up' | 'down' | 'flat'
export type Vies = 'altista' | 'baixista' | 'neutro'

/** Limiar (em %) abaixo do qual a variação é considerada estável (flat). */
export const LIMIAR_FLAT_PCT = 0.05

export interface PanoramaItem {
  rotulo: string
  valor: string
  variacao?: number | null
  seta?: Seta
  nota?: string
}

export interface PanoramaFonte {
  fonte: string
  titulo: string
  itens: PanoramaItem[]
}

export interface PanoramaSinal {
  texto: string
  vies: Vies
}

export interface PanoramaIntel {
  grao: Grao
  /** Carimbado pelo caller (sem data do sistema na lib). */
  geradoEm: string
  fontes: PanoramaFonte[]
  sinais: PanoramaSinal[]
}

// ── Inputs (dados já buscados, injetados) ───────────────────────────────────

/**
 * Oferta x demanda (USDA PSD). Cada métrica traz o valor atual e o anterior
 * já em milhões de toneladas (ou unidade própria). variacao opcional já
 * calculada; se ausente, é derivada de atual/anterior.
 */
export interface OfertaDemandaInput {
  /** Mês/WASDE de referência, ex.: 'Junho 2026'. */
  referencia?: string
  estoqueFinal?: MetricaInput
  producao?: MetricaInput
  produtividade?: MetricaInput
}

export interface MetricaInput {
  atual: number | null
  anterior?: number | null
  /** Unidade exibida, ex.: 'Mt'. Default 'Mt'. */
  unidade?: string
}

/** Exportações semanais (USDA ESR). */
export interface ExportacoesInput {
  /** Ano-safra de mercado, ex.: 2026. */
  marketYear?: number
  /** Vendas semanais (semana corrente). */
  vendasSemana: number | null
  /** Vendas semanais da semana anterior (para variação). */
  vendasSemanaAnterior?: number | null
  /** Vendas acumuladas no ano-safra. */
  acumulado?: number | null
  /** Vendas em carteira (outstanding). */
  emCarteira?: number | null
  /** Unidade, ex.: 'mil t'. Default 'mil t'. */
  unidade?: string
}

/** Boletim Focus (BCB) — projeções macro. */
export interface FocusInput {
  /** Projeção de câmbio (USD/BRL) para o ano corrente. */
  cambio?: FocusIndicador
  selic?: FocusIndicador
  ipca?: FocusIndicador
  pib?: FocusIndicador
}

export interface FocusIndicador {
  /** Mês/ano de referência da projeção, ex.: '12/2026'. */
  dataReferencia?: string
  mediana: number | null
  media?: number | null
  /** Projeção da coleta anterior (para variação de expectativa). */
  medianaAnterior?: number | null
}

/** CONAB — safra brasileira. */
export interface ConabInput {
  /** Safra/ano-agrícola, ex.: '2025/26'. */
  safra?: string
  /** Produção em milhões de toneladas. */
  producaoMt: number | null
  /** Produção da safra anterior em Mt (para variação). */
  producaoMtAnterior?: number | null
  /** Área plantada em milhões de ha. */
  areaMilhaoHa?: number | null
  /** Produtividade (kg/ha ou unidade própria). */
  produtividade?: number | null
}

/** Dólar presente (PTAX / interbancário). */
export interface DolarPresenteInput {
  valor: number | null
  /** Valor anterior (fechamento dia anterior) para variação. */
  anterior?: number | null
  fonte?: string
}

/** Ponto da curva de dólar futuro (derivado do Focus). */
export interface DolarFuturoPonto {
  mesRef: string
  mediana: number | null
  media?: number | null
  min?: number | null
  max?: number | null
}

export interface MontarPanoramaInput {
  grao: Grao
  geradoEm: string
  ofertaDemanda?: OfertaDemandaInput | null
  exportacoes?: ExportacoesInput | null
  focus?: FocusInput | null
  conab?: ConabInput | null
  dolarPresente?: DolarPresenteInput | null
  dolarFuturo?: DolarFuturoPonto[] | null
}

// ── Helpers de cálculo ──────────────────────────────────────────────────────

const ROTULO_GRAO: Record<Grao, string> = {
  soja: 'Soja',
  milho: 'Milho',
}

/**
 * Calcula variação percentual de `atual` relativa a `base`.
 * Retorna { pct: null, seta: 'flat' } quando faltam dados ou base é zero.
 */
export function calcularVariacao(
  atual: number | null | undefined,
  base: number | null | undefined,
): { pct: number | null; seta: Seta } {
  if (
    atual === null ||
    atual === undefined ||
    base === null ||
    base === undefined ||
    base === 0
  ) {
    return { pct: null, seta: 'flat' }
  }
  const pct = ((atual - base) / base) * 100
  let seta: Seta
  if (Math.abs(pct) < LIMIAR_FLAT_PCT) {
    seta = 'flat'
  } else if (pct > 0) {
    seta = 'up'
  } else {
    seta = 'down'
  }
  return { pct, seta }
}

/** Formata número com N casas + sufixo de unidade. Null → '—'. */
function fmt(v: number | null | undefined, casas = 1, unidade = ''): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  const num = v.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
  return unidade ? `${num} ${unidade}` : num
}

/** Formata BRL (R$). Null → '—'. */
function fmtBrl(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })
}

// ── classificarVies ─────────────────────────────────────────────────────────

/**
 * Sinal direcional de uma única variação para o preço da commodity.
 * `peso` define como o aumento (seta 'up') afeta o preço:
 *  - 'altista': aumento empurra preço para cima (ex.: exportação, dólar).
 *  - 'baixista': aumento empurra preço para baixo (ex.: estoque, produção).
 * Retorna +1 (altista), -1 (baixista) ou 0 (neutro/flat).
 */
export function sinalDaVariacao(
  seta: Seta,
  peso: 'altista' | 'baixista',
): -1 | 0 | 1 {
  if (seta === 'flat') return 0
  const sobe = seta === 'up'
  if (peso === 'altista') return sobe ? 1 : -1
  // peso baixista: subir é baixista, cair é altista
  return sobe ? -1 : 1
}

/**
 * Classifica o viés agregado a partir de um conjunto de contribuições
 * direcionais (+1 altista, -1 baixista, 0 neutro). O resultado é o sinal
 * da soma: positivo → 'altista', negativo → 'baixista', zero → 'neutro'.
 */
export function classificarVies(contribuicoes: number[]): Vies {
  const soma = contribuicoes.reduce((acc, c) => acc + c, 0)
  if (soma > 0) return 'altista'
  if (soma < 0) return 'baixista'
  return 'neutro'
}

// ── Builders por fonte ──────────────────────────────────────────────────────

/** Monta o bloco de oferta x demanda (USDA PSD) e seus sinais. */
function blocoOfertaDemanda(
  od: OfertaDemandaInput,
  grao: Grao,
): { bloco: PanoramaFonte; sinais: PanoramaSinal[] } {
  const itens: PanoramaItem[] = []
  const sinais: PanoramaSinal[] = []
  const nomeGrao = ROTULO_GRAO[grao]

  const adicionar = (
    rotulo: string,
    m: MetricaInput | undefined,
    peso: 'altista' | 'baixista',
  ) => {
    if (!m) return
    const { pct, seta } = calcularVariacao(m.atual, m.anterior ?? null)
    const unidade = m.unidade ?? 'Mt'
    itens.push({
      rotulo,
      valor: fmt(m.atual, 1, unidade),
      variacao: pct,
      seta,
    })
    if (seta !== 'flat') {
      const sinal = sinalDaVariacao(seta, peso)
      const direcao = seta === 'up' ? 'em alta' : 'em queda'
      sinais.push({
        texto: `${rotulo} de ${nomeGrao} ${direcao} (USDA)`,
        vies: sinal > 0 ? 'altista' : sinal < 0 ? 'baixista' : 'neutro',
      })
    }
  }

  // Estoque final: subir = baixista. Produção/produtividade: subir = baixista.
  adicionar('Estoques Finais', od.estoqueFinal, 'baixista')
  adicionar('Produção', od.producao, 'baixista')
  adicionar('Produtividade', od.produtividade, 'baixista')

  const bloco: PanoramaFonte = {
    fonte: 'USDA PSD',
    titulo: `Oferta & Demanda — ${nomeGrao}${od.referencia ? ` (${od.referencia})` : ''}`,
    itens,
  }
  return { bloco, sinais }
}

/** Monta o bloco de exportações (USDA ESR) e seu sinal. */
function blocoExportacoes(
  ex: ExportacoesInput,
  grao: Grao,
): { bloco: PanoramaFonte; sinais: PanoramaSinal[] } {
  const itens: PanoramaItem[] = []
  const sinais: PanoramaSinal[] = []
  const nomeGrao = ROTULO_GRAO[grao]
  const unidade = ex.unidade ?? 'mil t'

  const { pct, seta } = calcularVariacao(
    ex.vendasSemana,
    ex.vendasSemanaAnterior ?? null,
  )

  itens.push({
    rotulo: 'Vendas na semana',
    valor: fmt(ex.vendasSemana, 0, unidade),
    variacao: pct,
    seta,
  })
  if (ex.acumulado !== undefined && ex.acumulado !== null) {
    itens.push({ rotulo: 'Acumulado (safra)', valor: fmt(ex.acumulado, 0, unidade) })
  }
  if (ex.emCarteira !== undefined && ex.emCarteira !== null) {
    itens.push({ rotulo: 'Em carteira', valor: fmt(ex.emCarteira, 0, unidade) })
  }

  // Exportação subindo = altista (mais demanda).
  if (seta !== 'flat') {
    const sinal = sinalDaVariacao(seta, 'altista')
    const direcao = seta === 'up' ? 'aceleram' : 'desaceleram'
    sinais.push({
      texto: `Exportações de ${nomeGrao} ${direcao} (USDA ESR)`,
      vies: sinal > 0 ? 'altista' : 'baixista',
    })
  }

  const bloco: PanoramaFonte = {
    fonte: 'USDA ESR',
    titulo: `Exportações Semanais — ${nomeGrao}${ex.marketYear ? ` (${ex.marketYear})` : ''}`,
    itens,
  }
  return { bloco, sinais }
}

/** Monta o bloco do Boletim Focus (BCB). Câmbio gera sinal altista p/ R$. */
function blocoFocus(
  focus: FocusInput,
  grao: Grao,
): { bloco: PanoramaFonte; sinais: PanoramaSinal[] } {
  const itens: PanoramaItem[] = []
  const sinais: PanoramaSinal[] = []
  const nomeGrao = ROTULO_GRAO[grao]

  if (focus.cambio) {
    const c = focus.cambio
    const { pct, seta } = calcularVariacao(c.mediana, c.medianaAnterior ?? null)
    itens.push({
      rotulo: `Dólar projetado${c.dataReferencia ? ` (${c.dataReferencia})` : ''}`,
      valor: fmtBrl(c.mediana),
      variacao: pct,
      seta,
      nota: 'mediana das expectativas',
    })
    // Dólar projetado subindo = altista para preço em R$.
    if (seta !== 'flat') {
      const sinal = sinalDaVariacao(seta, 'altista')
      const direcao = seta === 'up' ? 'em alta' : 'em queda'
      sinais.push({
        texto: `Dólar projetado ${direcao} pressiona o preço de ${nomeGrao} em R$ (Focus)`,
        vies: sinal > 0 ? 'altista' : 'baixista',
      })
    }
  }
  if (focus.selic) {
    itens.push({ rotulo: 'Selic projetada', valor: fmt(focus.selic.mediana, 2, '%') })
  }
  if (focus.ipca) {
    itens.push({ rotulo: 'IPCA projetado', valor: fmt(focus.ipca.mediana, 2, '%') })
  }
  if (focus.pib) {
    itens.push({ rotulo: 'PIB projetado', valor: fmt(focus.pib.mediana, 2, '%') })
  }

  const bloco: PanoramaFonte = {
    fonte: 'BCB Focus',
    titulo: 'Boletim Focus — Projeções de Mercado',
    itens,
  }
  return { bloco, sinais }
}

/** Monta o bloco da CONAB (safra brasileira) e seu sinal. */
function blocoConab(
  conab: ConabInput,
  grao: Grao,
): { bloco: PanoramaFonte; sinais: PanoramaSinal[] } {
  const itens: PanoramaItem[] = []
  const sinais: PanoramaSinal[] = []
  const nomeGrao = ROTULO_GRAO[grao]

  const { pct, seta } = calcularVariacao(
    conab.producaoMt,
    conab.producaoMtAnterior ?? null,
  )
  itens.push({
    rotulo: 'Produção Brasil',
    valor: fmt(conab.producaoMt, 1, 'Mt'),
    variacao: pct,
    seta,
  })
  if (conab.areaMilhaoHa !== undefined && conab.areaMilhaoHa !== null) {
    itens.push({ rotulo: 'Área plantada', valor: fmt(conab.areaMilhaoHa, 1, 'mi ha') })
  }
  if (conab.produtividade !== undefined && conab.produtividade !== null) {
    itens.push({ rotulo: 'Produtividade', valor: fmt(conab.produtividade, 0, 'kg/ha') })
  }

  // Produção brasileira subindo = baixista (mais oferta).
  if (seta !== 'flat') {
    const sinal = sinalDaVariacao(seta, 'baixista')
    const direcao = seta === 'up' ? 'maior' : 'menor'
    sinais.push({
      texto: `Safra brasileira de ${nomeGrao} ${direcao} (CONAB)`,
      vies: sinal > 0 ? 'altista' : 'baixista',
    })
  }

  const bloco: PanoramaFonte = {
    fonte: 'CONAB',
    titulo: `Safra Brasileira — ${nomeGrao}${conab.safra ? ` (${conab.safra})` : ''}`,
    itens,
  }
  return { bloco, sinais }
}

/** Monta o bloco de câmbio (dólar presente + curva futura do Focus). */
function blocoCambio(
  presente: DolarPresenteInput | null | undefined,
  futuro: DolarFuturoPonto[] | null | undefined,
  grao: Grao,
): { bloco: PanoramaFonte; sinais: PanoramaSinal[] } | null {
  const temPresente = presente && presente.valor !== null && presente.valor !== undefined
  const temFuturo = futuro && futuro.length > 0
  if (!temPresente && !temFuturo) return null

  const itens: PanoramaItem[] = []
  const sinais: PanoramaSinal[] = []
  const nomeGrao = ROTULO_GRAO[grao]

  if (temPresente) {
    const { pct, seta } = calcularVariacao(presente!.valor, presente!.anterior ?? null)
    itens.push({
      rotulo: 'Dólar à vista',
      valor: fmtBrl(presente!.valor),
      variacao: pct,
      seta,
      nota: presente!.fonte,
    })
  }

  if (temFuturo) {
    // Compara o último ponto da curva (mais distante) com o dólar presente
    // (ou com o primeiro ponto da curva) para inferir a tendência.
    const pontos = futuro!.filter((p) => p.mediana !== null && p.mediana !== undefined)
    if (pontos.length > 0) {
      const ultimo = pontos[pontos.length - 1]
      const ancora = temPresente ? presente!.valor : pontos[0].mediana
      itens.push({
        rotulo: `Curva — ${ultimo.mesRef}`,
        valor: fmtBrl(ultimo.mediana),
        nota: 'projeção mais distante',
      })
      const { pct, seta } = calcularVariacao(ultimo.mediana, ancora)
      // Dólar futuro acima do presente = altista para preço em R$.
      if (seta !== 'flat') {
        const sinal = sinalDaVariacao(seta, 'altista')
        const direcao = seta === 'up' ? 'em alta' : 'em queda'
        sinais.push({
          texto: `Curva de dólar futuro ${direcao} sustenta o preço de ${nomeGrao} em R$`,
          vies: sinal > 0 ? 'altista' : 'baixista',
        })
      }
      // anota a variação no item da curva
      itens[itens.length - 1].variacao = pct
      itens[itens.length - 1].seta = seta
    }
  }

  const bloco: PanoramaFonte = {
    fonte: 'Câmbio',
    titulo: 'Dólar — Presente & Curva Futura',
    itens,
  }
  return { bloco, sinais }
}

// ── montarPanorama ──────────────────────────────────────────────────────────

/**
 * Consolida todas as fontes presentes num PanoramaIntel. Fontes ausentes
 * (undefined/null) são OMITIDAS dos blocos. Os sinais são a leitura agregada
 * do viés de cada fonte.
 */
export function montarPanorama(input: MontarPanoramaInput): PanoramaIntel {
  const { grao, geradoEm } = input
  const fontes: PanoramaFonte[] = []
  const sinais: PanoramaSinal[] = []

  if (input.ofertaDemanda) {
    const { bloco, sinais: s } = blocoOfertaDemanda(input.ofertaDemanda, grao)
    if (bloco.itens.length > 0) fontes.push(bloco)
    sinais.push(...s)
  }

  if (input.exportacoes) {
    const { bloco, sinais: s } = blocoExportacoes(input.exportacoes, grao)
    if (bloco.itens.length > 0) fontes.push(bloco)
    sinais.push(...s)
  }

  if (input.focus) {
    const { bloco, sinais: s } = blocoFocus(input.focus, grao)
    if (bloco.itens.length > 0) fontes.push(bloco)
    sinais.push(...s)
  }

  if (input.conab) {
    const { bloco, sinais: s } = blocoConab(input.conab, grao)
    if (bloco.itens.length > 0) fontes.push(bloco)
    sinais.push(...s)
  }

  const cambio = blocoCambio(input.dolarPresente, input.dolarFuturo, grao)
  if (cambio && cambio.bloco.itens.length > 0) {
    fontes.push(cambio.bloco)
    sinais.push(...cambio.sinais)
  }

  return {
    grao,
    geradoEm,
    fontes,
    sinais,
  }
}

/**
 * Deriva o viés GERAL do panorama a partir de todos os seus sinais.
 * Útil para um selo-resumo. Cada sinal vale +1 (altista) ou -1 (baixista).
 */
export function viesGeral(panorama: PanoramaIntel): Vies {
  const contribuicoes = panorama.sinais.map((s) =>
    s.vies === 'altista' ? 1 : s.vies === 'baixista' ? -1 : 0,
  )
  return classificarVies(contribuicoes)
}
