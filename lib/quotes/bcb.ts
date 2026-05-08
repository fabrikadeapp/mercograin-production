/**
 * Banco Central do Brasil — PTAX (taxa de câmbio oficial).
 * API pública sem chave, sem rate limit notável, aceita IPs cloud.
 *
 * Endpoint: /olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia
 * Atualiza várias vezes ao dia (PTAX intra-day) com bid/ask oficiais.
 */

const BCB_BASE = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata'

export interface BcbDolarQuote {
  cotacaoCompra: number | null  // bid (BCB compra moeda estrangeira)
  cotacaoVenda: number | null   // ask (BCB vende moeda estrangeira)
  dataHoraCotacao: string | null
  fetchedAt: string
}

interface CacheEntry { data: BcbDolarQuote | null; at: number }
const TTL = 60_000  // 1 min — PTAX atualiza algumas vezes ao dia, 1min sobra
const cache = new Map<string, CacheEntry>()

function n(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') { const x = Number(v); return Number.isFinite(x) ? x : null }
  return null
}

function formatDateBR(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}-${dd}-${yyyy}`
}

/**
 * Busca a última cotação do dólar do dia. Se hoje não tiver (sábado/domingo/feriado),
 * tenta os últimos 5 dias úteis até achar.
 */
export async function fetchBcbDolar(): Promise<BcbDolarQuote> {
  const now = Date.now()
  const cached = cache.get('USDBRL')
  if (cached?.data && now - cached.at < TTL) return cached.data

  const fetchedAt = new Date(now).toISOString()
  const empty: BcbDolarQuote = {
    cotacaoCompra: null,
    cotacaoVenda: null,
    dataHoraCotacao: null,
    fetchedAt,
  }

  // Tenta hoje, ontem, anteontem... até 7 dias
  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    const d = new Date(now - daysAgo * 86400000)
    const date = formatDateBR(d)
    try {
      const url = `${BCB_BASE}/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${date}'&$format=json`
      const r = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })
      if (!r.ok) continue
      const j = await r.json() as { value?: Array<any> }
      const items = j.value || []
      if (items.length === 0) continue

      // Pega a última cotação do dia (mais recente)
      const last = items[items.length - 1]
      const result: BcbDolarQuote = {
        cotacaoCompra: n(last.cotacaoCompra),
        cotacaoVenda: n(last.cotacaoVenda),
        dataHoraCotacao: last.dataHoraCotacao || null,
        fetchedAt,
      }
      cache.set('USDBRL', { data: result, at: now })
      return result
    } catch (e: any) {
      console.warn(`[bcb] tentativa ${date} falhou:`, e?.message || e)
      continue
    }
  }

  // Cache stale como fallback
  if (cached?.data) return cached.data
  return empty
}
