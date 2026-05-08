/**
 * CEPEA/ESALQ — preço à vista oficial brasileiro de grãos.
 *
 * Indicadores oficiais (sc 60kg salvo trigo, em t):
 *   ID 92  · Soja Paranaguá   · R$/sc 60kg
 *   ID 77  · Milho            · R$/sc 60kg
 *   ID 178 · Trigo - PR       · R$/t (convertido para sc 60kg dividindo por 16,6667)
 *
 * Fonte: widget oficial cepea.org.br/br/widgetproduto.js.php
 * O retorno é JS document.write contendo HTML — parseamos via regex.
 *
 * NÃO há histórico via widget. Para sparkline usamos snapshots persistidos
 * no banco (model Cotacao) ou fallback para fetchSparkline da Twelve Data.
 */

const CEPEA_URL = 'https://www.cepea.org.br/br/widgetproduto.js.php'

// User-Agent realista — sem ele o Cloudflare do CEPEA bloqueia
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

export type CepeaLabel = 'soja' | 'milho' | 'trigo'

interface CepeaConfig {
  id: number
  displayName: string
  unit: 'sc60' | 'ton'  // unidade nativa do retorno
}

export const CEPEA_INDICATORS: Record<CepeaLabel, CepeaConfig> = {
  soja:  { id: 92,  displayName: 'Soja Paranaguá', unit: 'sc60' },
  milho: { id: 77,  displayName: 'Milho',          unit: 'sc60' },
  trigo: { id: 178, displayName: 'Trigo · PR',     unit: 'ton'  },
}

// 1 tonelada = 1000 kg / 60 kg/sc = 16,6667 sc
const TON_TO_SC60 = 1000 / 60

export interface CepeaQuote {
  label: CepeaLabel
  indicatorId: number
  displayName: string
  /** Preço em R$/sc 60kg (já convertido do nativo). */
  precoSc60: number | null
  /** Preço bruto exatamente como o CEPEA divulga, na unidade nativa. */
  precoBruto: number | null
  unidadeBruta: 'sc 60kg' | 't'
  dataReferencia: string | null  // ex: "07/05/2026"
  fetchedAt: string
}

function parseBrazilianNumber(raw: string): number | null {
  // CEPEA usa formato "1.704,29" ou "127,38"
  const s = raw.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

interface ParsedRow {
  date: string
  product: string
  unit: string
  price: number | null
}

function parseWidgetHtml(body: string): ParsedRow[] {
  // Extrai linhas <tr> dentro de <tbody>
  const rows: ParsedRow[] = []
  const tbodyMatch = body.match(/<tbody>([\s\S]*?)<\/tbody>/)
  if (!tbodyMatch) return rows

  const rowMatches = tbodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)
  for (const m of rowMatches) {
    const html = m[1]
    const tds = [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) => x[1])
    if (tds.length < 3) continue

    const date = tds[0].replace(/<[^>]+>/g, '').trim()
    const productMatch = tds[1].match(/class="maior">([^<]+)/)
    const unitMatch = tds[1].match(/class="unidade">([^<]+)/)
    const priceMatch = tds[2].match(/class="maior">([0-9.,]+)/)

    rows.push({
      date,
      product: productMatch?.[1].trim() || '',
      unit: unitMatch?.[1].trim() || '',
      price: priceMatch ? parseBrazilianNumber(priceMatch[1]) : null,
    })
  }
  return rows
}

/**
 * Faz uma única chamada ao widget agregando todos os indicadores
 * (CEPEA aceita id_indicador[]= múltiplas vezes na mesma URL).
 */
export async function fetchCepeaQuotes(
  labels: CepeaLabel[] = ['soja', 'milho', 'trigo']
): Promise<Record<CepeaLabel, CepeaQuote>> {
  const ids = labels.map((l) => CEPEA_INDICATORS[l].id)
  const params = new URLSearchParams()
  for (const id of ids) params.append('id_indicador[]', String(id))
  // Parâmetros estéticos exigidos pelo widget (sem afetar dados)
  params.set('fonte', 'arial')
  params.set('tamanho', '10')
  params.set('largura', '400px')
  params.set('corfundo', 'dadada')
  params.set('cortexto', '333333')
  params.set('corlinha', 'ede7d6')

  const url = `${CEPEA_URL}?${params.toString()}`
  const fetchedAt = new Date().toISOString()

  const out: Record<CepeaLabel, CepeaQuote> = {} as any
  for (const label of labels) {
    const cfg = CEPEA_INDICATORS[label]
    out[label] = {
      label,
      indicatorId: cfg.id,
      displayName: cfg.displayName,
      precoSc60: null,
      precoBruto: null,
      unidadeBruta: cfg.unit === 'ton' ? 't' : 'sc 60kg',
      dataReferencia: null,
      fetchedAt,
    }
  }

  try {
    const r = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': UA, 'Accept': '*/*' },
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) {
      console.warn(`[cepea] HTTP ${r.status}`)
      return out
    }
    const body = await r.text()
    const rows = parseWidgetHtml(body)

    for (const label of labels) {
      const cfg = CEPEA_INDICATORS[label]
      // Match por nome de produto (CEPEA não retorna o ID na resposta)
      const row = rows.find((rw) =>
        rw.product.toLowerCase().includes(matchKey(label))
      )
      if (!row || row.price === null) continue

      const precoSc60 =
        cfg.unit === 'ton' ? row.price / TON_TO_SC60 : row.price

      out[label] = {
        label,
        indicatorId: cfg.id,
        displayName: cfg.displayName,
        precoSc60: Number(precoSc60.toFixed(2)),
        precoBruto: row.price,
        unidadeBruta: cfg.unit === 'ton' ? 't' : 'sc 60kg',
        dataReferencia: row.date || null,
        fetchedAt,
      }
    }
  } catch (e: any) {
    console.warn('[cepea] fetch failed:', e?.message || e)
  }

  return out
}

function matchKey(label: CepeaLabel): string {
  switch (label) {
    case 'soja':  return 'soja'
    case 'milho': return 'milho'
    case 'trigo': return 'trigo'
  }
}

export async function fetchCepeaQuote(label: CepeaLabel): Promise<CepeaQuote> {
  const all = await fetchCepeaQuotes([label])
  return all[label]
}
