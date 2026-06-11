/**
 * lib/usda/relatorio.ts
 *
 * Lib PURA que monta a estrutura do relatório "USDA Projeções" (estilo BIOND)
 * a partir de registros já buscados do USDA PSD. NÃO faz fetch — recebe os
 * dados prontos e calcula variações (mensal vs WASDE anterior, anual vs safra
 * passada).
 *
 * Convenções USDA PSD:
 * - value vem em "mil unidades" (ex.: unit 8 = '1000 MT' → mil toneladas).
 *   Para milhões de toneladas, dividir por 1000.
 * - marketYear=2026 é a safra 25/26 corrente.
 * - O 'month' indica qual WASDE; comparar com month-1 dá a variação mensal e
 *   com marketYear-1 dá a variação anual (safra passada).
 *
 * Esta lib não usa data/hora do sistema: `geradoEm` é recebido por parâmetro.
 */

export type Grao = 'soja' | 'milho'
export type Secao = 'mundo' | 'eua' | 'brasil_argentina'
export type Metrica = 'estoqueFinal' | 'producao' | 'produtividade'
export type Seta = 'up' | 'down' | 'flat'

/** Limiar (em %) abaixo do qual a variação é considerada estável (flat). */
export const LIMIAR_FLAT_PCT = 0.05

export interface LinhaRelatorio {
  rotulo: string
  /** Valor atual em milhões de toneladas (ou unidade da métrica). */
  atual: number | null
  /** Valor do WASDE anterior (month-1). */
  anterior: number | null
  /** Valor da safra passada (marketYear-1). */
  safraPassada: number | null
  /** Variação percentual atual vs anterior. */
  variacaoMensal: number | null
  /** Variação percentual atual vs safra passada. */
  variacaoAnual: number | null
  setaMensal: Seta
  setaAnual: Seta
}

export interface SecaoRelatorio {
  titulo: string
  grao: Grao
  linhas: LinhaRelatorio[]
}

export interface RelatorioUsda {
  titulo: string
  mesReferencia: string
  /** Carimbado pelo caller (sem data do sistema na lib). */
  geradoEm: string
  secoes: SecaoRelatorio[]
  fonte: string
}

/**
 * Valores de uma métrica para uma combinação grão+seção, já em mil-toneladas
 * (formato cru do PSD). Cada campo pode ser null quando o dado não existe.
 */
export interface ValoresMetrica {
  atualMt: number | null
  anteriorMt: number | null
  safraPassadaMt: number | null
}

/** Mapa de dados: dados[grao][secao][metrica] = ValoresMetrica. */
export type DadosRelatorio = Partial<
  Record<Grao, Partial<Record<Secao, Partial<Record<Metrica, ValoresMetrica>>>>>
>

export interface ConfigRelatorio {
  graos: Grao[]
  secoes: Secao[]
  metricas: Metrica[]
  dados: DadosRelatorio
  /** Mês de referência do WASDE, ex.: 'Junho 2026'. */
  mesReferencia?: string
  /** Carimbo de geração (ISO ou legível). Default ''. */
  geradoEm?: string
  /** Título do relatório. */
  titulo?: string
}

const ROTULO_GRAO: Record<Grao, string> = {
  soja: 'Soja',
  milho: 'Milho',
}

const ROTULO_SECAO: Record<Secao, string> = {
  mundo: 'Mundo',
  eua: 'EUA',
  brasil_argentina: 'Brasil + Argentina',
}

const ROTULO_METRICA: Record<Metrica, string> = {
  estoqueFinal: 'Estoques Finais',
  producao: 'Produção',
  produtividade: 'Produtividade',
}

/**
 * Calcula a variação percentual de `atual` relativa a `base`.
 * - Retorna { pct: null, seta: 'flat' } quando faltam dados ou base é zero
 *   (evita divisão por zero).
 * - `seta` é 'flat' quando |pct| < LIMIAR_FLAT_PCT.
 */
export function calcularVariacao(
  atual: number | null,
  base: number | null,
): { pct: number | null; seta: Seta } {
  if (atual === null || base === null || base === 0) {
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

/** Converte mil-toneladas (PSD) → milhões de toneladas; preserva null. */
function paraMilhoes(milTon: number | null): number | null {
  if (milTon === null) return null
  return milTon / 1000
}

/**
 * Monta uma LinhaRelatorio a partir dos valores crus (mil-toneladas).
 * Converte para milhões (÷1000) e calcula as variações mensal e anual.
 */
export function montarLinha(
  rotulo: string,
  atualMt: number | null,
  anteriorMt: number | null,
  safraPassadaMt: number | null,
): LinhaRelatorio {
  const atual = paraMilhoes(atualMt)
  const anterior = paraMilhoes(anteriorMt)
  const safraPassada = paraMilhoes(safraPassadaMt)

  const mensal = calcularVariacao(atual, anterior)
  const anual = calcularVariacao(atual, safraPassada)

  return {
    rotulo,
    atual,
    anterior,
    safraPassada,
    variacaoMensal: mensal.pct,
    variacaoAnual: anual.pct,
    setaMensal: mensal.seta,
    setaAnual: anual.seta,
  }
}

/**
 * Monta o relatório completo, configurável: só inclui grãos/seções/métricas
 * que o usuário pediu e que existirem em `dados`. Seções sem nenhuma linha são
 * omitidas.
 */
export function montarRelatorio(config: ConfigRelatorio): RelatorioUsda {
  const {
    graos,
    secoes,
    metricas,
    dados,
    mesReferencia = '',
    geradoEm = '',
    titulo = 'USDA Projeções',
  } = config

  const secoesRelatorio: SecaoRelatorio[] = []

  for (const grao of graos) {
    const dadosGrao = dados[grao]
    if (!dadosGrao) continue

    for (const secao of secoes) {
      const dadosSecao = dadosGrao[secao]
      if (!dadosSecao) continue

      const linhas: LinhaRelatorio[] = []
      for (const metrica of metricas) {
        const valores = dadosSecao[metrica]
        if (!valores) continue
        linhas.push(
          montarLinha(
            ROTULO_METRICA[metrica],
            valores.atualMt,
            valores.anteriorMt,
            valores.safraPassadaMt,
          ),
        )
      }

      if (linhas.length === 0) continue

      secoesRelatorio.push({
        titulo: `${ROTULO_GRAO[grao]} — ${ROTULO_SECAO[secao]}`,
        grao,
        linhas,
      })
    }
  }

  return {
    titulo,
    mesReferencia,
    geradoEm,
    secoes: secoesRelatorio,
    fonte: 'USDA',
  }
}

/**
 * Relatório de exemplo (plausível) para preview sem chave de API.
 * Valores em mil-toneladas espelhando a referência BIOND (ex.: soja mundo
 * estoques finais 25/26 ≈ 124,9 Mt → 124883 mil-ton).
 * O caller deve passar `geradoEm` (a lib não carimba data do sistema).
 */
export function relatorioExemplo(geradoEm = ''): RelatorioUsda {
  const dados: DadosRelatorio = {
    soja: {
      mundo: {
        estoqueFinal: { atualMt: 124883, anteriorMt: 123200, safraPassadaMt: 111100 },
        producao: { atualMt: 426300, anteriorMt: 425100, safraPassadaMt: 394700 },
        produtividade: { atualMt: 2920, anteriorMt: 2915, safraPassadaMt: 2810 },
      },
      eua: {
        estoqueFinal: { atualMt: 8300, anteriorMt: 9530, safraPassadaMt: 9560 },
        producao: { atualMt: 118800, anteriorMt: 118800, safraPassadaMt: 121100 },
        produtividade: { atualMt: 3520, anteriorMt: 3520, safraPassadaMt: 3490 },
      },
      brasil_argentina: {
        estoqueFinal: { atualMt: 38200, anteriorMt: 37900, safraPassadaMt: 35100 },
        producao: { atualMt: 224000, anteriorMt: 223000, safraPassadaMt: 217000 },
        produtividade: { atualMt: 3360, anteriorMt: 3355, safraPassadaMt: 3300 },
      },
    },
    milho: {
      mundo: {
        estoqueFinal: { atualMt: 277800, anteriorMt: 275500, safraPassadaMt: 287900 },
        producao: { atualMt: 1265700, anteriorMt: 1262100, safraPassadaMt: 1217500 },
        produtividade: { atualMt: 6180, anteriorMt: 6170, safraPassadaMt: 6020 },
      },
      eua: {
        estoqueFinal: { atualMt: 44600, anteriorMt: 45100, safraPassadaMt: 37300 },
        producao: { atualMt: 401800, anteriorMt: 401800, safraPassadaMt: 377600 },
        produtividade: { atualMt: 11470, anteriorMt: 11470, safraPassadaMt: 11280 },
      },
      brasil_argentina: {
        estoqueFinal: { atualMt: 12100, anteriorMt: 12300, safraPassadaMt: 11800 },
        producao: { atualMt: 184000, anteriorMt: 183500, safraPassadaMt: 178000 },
        produtividade: { atualMt: 5560, anteriorMt: 5555, safraPassadaMt: 5480 },
      },
    },
  }

  return montarRelatorio({
    graos: ['soja', 'milho'],
    secoes: ['mundo', 'eua', 'brasil_argentina'],
    metricas: ['estoqueFinal', 'producao', 'produtividade'],
    dados,
    mesReferencia: 'Junho 2026',
    geradoEm,
    titulo: 'USDA Projeções — Soja e Milho',
  })
}
