/**
 * CONAB — Companhia Nacional de Abastecimento.
 * Série histórica de grãos (safra brasileira). CSV público, sem chave.
 *
 * Fonte: https://portaldeinformacoes.conab.gov.br/downloads/arquivos/SerieHistoricaGraos.txt
 * CSV separado por ';' com header:
 *   ano_agricola;dsc_safra_previsao;uf;produto;id_produto;
 *   area_plantada_mil_ha;producao_mil_t;produtividade_mil_ha_mil_t
 *
 * Estratégia: best-effort, NUNCA lança. Cache TTL longo (~12h, dados mudam
 * mensalmente). Timeout generoso (20s) — arquivo é grande. parseCsv é função
 * PURA (recebe texto, devolve registros) para ser testável sem rede.
 */

const CONAB_URL =
  'https://portaldeinformacoes.conab.gov.br/downloads/arquivos/SerieHistoricaGraos.txt'

const TTL = 12 * 60 * 60 * 1000 // 12h
const TIMEOUT_MS = 20_000

export type ConabSafra = {
  anoAgricola: string
  produto: string // 'SOJA' | 'MILHO' (normalizado)
  areaMilHa: number
  producaoMilT: number
  produtividade: number // mil t / mil ha (= t/ha)
}

/** Registro cru já com campos numéricos e UF, antes da agregação por ano. */
export type ConabRegistro = {
  anoAgricola: string
  produto: string // produto bruto normalizado ('SOJA' | 'MILHO')
  uf: string
  areaMilHa: number
  producaoMilT: number
  produtividade: number
}

/** Converte string numérica BR/US ('1.234,56' ou '1234.56' ou '1234,56') em number|null. */
function parseNum(v: string): number | null {
  if (!v) return null
  let s = v.trim()
  if (!s) return null
  // Remove separador de milhar e normaliza decimal.
  if (s.includes(',') && s.includes('.')) {
    // formato BR: '.' milhar, ',' decimal
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    // só vírgula → decimal BR
    s = s.replace(',', '.')
  }
  const x = Number(s)
  return Number.isFinite(x) ? x : null
}

/**
 * Normaliza o nome do produto bruto da CONAB para 'SOJA' | 'MILHO' | null.
 * 'MILHO TOTAL', 'MILHO 1A SAFRA', 'MILHO 2A SAFRA' → 'MILHO'.
 * 'SOJA' → 'SOJA'. Qualquer outro → null (ignorado).
 *
 * Para MILHO preferimos 'MILHO TOTAL' quando presente para evitar dupla
 * contagem de 1A+2A. A escolha entre TOTAL e somar safras é feita em safraBrasil.
 */
function normalizarProduto(bruto: string): 'SOJA' | 'MILHO' | null {
  const p = bruto.trim().toUpperCase()
  if (p === 'SOJA') return 'SOJA'
  if (p.startsWith('MILHO')) return 'MILHO'
  return null
}

/** Marca se uma linha de milho é o agregado 'TOTAL' (vs. safra parcial 1A/2A). */
function ehMilhoTotal(bruto: string): boolean {
  return bruto.trim().toUpperCase() === 'MILHO TOTAL'
}

/**
 * FUNÇÃO PURA. Parseia o texto CSV completo da CONAB e devolve registros
 * (por UF) já filtrados (só SOJA/MILHO) e numéricos. Tolera padding de
 * espaços nos campos e linhas malformadas (ignora).
 */
export function parseCsv(texto: string): ConabRegistro[] {
  const out: ConabRegistro[] = []
  if (!texto) return out

  const linhas = texto.split(/\r?\n/)
  let headerVisto = false

  for (const linhaRaw of linhas) {
    const linha = linhaRaw.trim()
    if (!linha) continue

    const cols = linha.split(';').map((c) => c.trim())

    // Detecta/pula o header (primeira linha com 'ano_agricola').
    if (!headerVisto) {
      const primeira = cols[0]?.toLowerCase()
      if (primeira === 'ano_agricola' || primeira?.startsWith('ano_agricola')) {
        headerVisto = true
        continue
      }
      // Se não houver header reconhecível, segue tentando dados.
      headerVisto = true
    }

    // Layout esperado (8 colunas):
    // ano_agricola;dsc_safra_previsao;uf;produto;id_produto;area;producao;produtividade
    if (cols.length < 8) continue

    const anoAgricola = cols[0]
    const uf = cols[2]
    const produtoBruto = cols[3]
    const area = parseNum(cols[5])
    const producao = parseNum(cols[6])
    const produtividade = parseNum(cols[7])

    if (!anoAgricola) continue
    const produto = normalizarProduto(produtoBruto)
    if (!produto) continue

    out.push({
      anoAgricola,
      // Preserva distinção de 'MILHO TOTAL' via campo bruto auxiliar não.
      // Em vez disso guardamos o bruto normalizado e detectamos TOTAL na agregação.
      produto: produto === 'MILHO' && ehMilhoTotal(produtoBruto) ? 'MILHO TOTAL' : produto,
      uf: uf || '',
      areaMilHa: area ?? 0,
      producaoMilT: producao ?? 0,
      produtividade: produtividade ?? 0,
    })
  }

  return out
}

/**
 * Agrega registros por ano_agricola para o Brasil total.
 * - SOJA: soma todas as UFs (linhas produto SOJA).
 * - MILHO: se houver linhas 'MILHO TOTAL', usa-as (soma UFs do TOTAL);
 *   senão soma 'MILHO' (1A+2A) por UF.
 * Recalcula produtividade como producao/area (mil t / mil ha) quando area>0.
 * FUNÇÃO PURA (separada para testes da agregação).
 */
export function agregarPorAno(
  registros: ConabRegistro[],
  produto: 'SOJA' | 'MILHO',
): ConabSafra[] {
  let relevantes: ConabRegistro[]

  if (produto === 'SOJA') {
    relevantes = registros.filter((r) => r.produto === 'SOJA')
  } else {
    const totais = registros.filter((r) => r.produto === 'MILHO TOTAL')
    if (totais.length > 0) {
      relevantes = totais
    } else {
      // Fallback: soma 1A + 2A (registros normalizados como 'MILHO').
      relevantes = registros.filter((r) => r.produto === 'MILHO')
    }
  }

  const porAno = new Map<string, { area: number; producao: number }>()
  for (const r of relevantes) {
    const acc = porAno.get(r.anoAgricola) ?? { area: 0, producao: 0 }
    acc.area += r.areaMilHa
    acc.producao += r.producaoMilT
    porAno.set(r.anoAgricola, acc)
  }

  const safras: ConabSafra[] = []
  for (const [anoAgricola, { area, producao }] of porAno) {
    const produtividade = area > 0 ? producao / area : 0
    safras.push({
      anoAgricola,
      produto,
      areaMilHa: area,
      producaoMilT: producao,
      produtividade,
    })
  }

  // Ordena por ano desc. ano_agricola tipicamente 'YYYY/YY' ou 'YYYY' — ordena
  // lexicograficamente pelo prefixo de ano (funciona para ambos os formatos).
  safras.sort((a, b) => b.anoAgricola.localeCompare(a.anoAgricola))
  return safras
}

interface CacheEntry {
  texto: string | null
  at: number
}
let cache: CacheEntry | null = null

/** Baixa o CSV cru (best-effort). Usa cache TTL. Nunca lança. */
async function baixarCsv(): Promise<string | null> {
  const now = Date.now()
  if (cache && cache.texto && now - cache.at < TTL) return cache.texto

  try {
    const r = await fetch(CONAB_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'text/plain,*/*' },
    })
    if (!r.ok) {
      if (cache?.texto) return cache.texto // stale fallback
      return null
    }
    const texto = await r.text()
    cache = { texto, at: now }
    return texto
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[conab] download falhou:', msg)
    if (cache?.texto) return cache.texto // stale fallback
    return null
  }
}

/**
 * Safra brasileira (total nacional) para soja ou milho, agregada por
 * ano_agricola, ordenada por ano desc, limitada às últimas N safras.
 * Best-effort: retorna [] se a fonte estiver indisponível. Nunca lança.
 */
export async function safraBrasil(
  produto: 'SOJA' | 'MILHO',
  ultimasN = 10,
): Promise<ConabSafra[]> {
  try {
    const texto = await baixarCsv()
    if (!texto) return []
    const registros = parseCsv(texto)
    const safras = agregarPorAno(registros, produto)
    return ultimasN > 0 ? safras.slice(0, ultimasN) : safras
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[conab] safraBrasil falhou:', msg)
    return []
  }
}

/**
 * Produção atual vs. safra anterior (Brasil total) + variação percentual.
 * Retorna null se a fonte estiver indisponível. Nunca lança.
 */
export async function producaoAtualVsAnterior(
  produto: 'SOJA' | 'MILHO',
): Promise<{
  atual: ConabSafra | null
  anterior: ConabSafra | null
  variacaoPct: number | null
} | null> {
  const safras = await safraBrasil(produto, 2)
  if (safras.length === 0) return null

  const atual = safras[0] ?? null
  const anterior = safras[1] ?? null

  let variacaoPct: number | null = null
  if (
    atual &&
    anterior &&
    anterior.producaoMilT > 0 &&
    Number.isFinite(atual.producaoMilT)
  ) {
    variacaoPct =
      ((atual.producaoMilT - anterior.producaoMilT) / anterior.producaoMilT) * 100
  }

  return { atual, anterior, variacaoPct }
}
