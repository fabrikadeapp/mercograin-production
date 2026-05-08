import { headers } from 'next/headers'

interface QuoteRow {
  symbol: string
  label: 'soja' | 'milho' | 'trigo' | 'usdbrl'
  price: number | null
  changePct: number | null
  currency: string
  fetchedAt: string
}

interface LivePayload {
  soja: QuoteRow
  milho: QuoteRow
  trigo: QuoteRow
  usdbrl: QuoteRow
  fetchedAt: string
}

async function fetchLive(): Promise<LivePayload | null> {
  try {
    const h = headers()
    const host = h.get('host')
    const proto = h.get('x-forwarded-proto') || 'http'
    const base = host ? `${proto}://${host}` : ''
    const res = await fetch(`${base}/api/cotacoes/live`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return (await res.json()) as LivePayload
  } catch {
    return null
  }
}

function fmtBRL(value: number | null, fractionDigits = 2) {
  if (value === null || Number.isNaN(value)) return '—'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

function secondsAgo(iso: string | undefined) {
  if (!iso) return null
  const diff = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  return diff
}

function QuoteCell({
  label,
  unit,
  quote,
  accentClass,
}: {
  label: string
  unit: string
  quote: QuoteRow | undefined
  accentClass: string
}) {
  const price = quote?.price ?? null
  const pct = quote?.changePct ?? null
  const pctLabel =
    pct === null ? '' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
  const pctColor =
    pct === null ? 'text-fg-3' : pct >= 0 ? 'text-pos' : 'text-neg'

  return (
    <div className="flex min-w-[160px] flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${accentClass}`} aria-hidden />
        <span className="text-micro uppercase tracking-wide text-fg-3">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="t-num-lg text-fg-1">
          {unit} {fmtBRL(price)}
        </span>
        {pctLabel && (
          <span className={`t-num text-small ${pctColor}`}>{pctLabel}</span>
        )}
      </div>
    </div>
  )
}

export async function LiveProof() {
  const data = await fetchLive()
  const ago = secondsAgo(data?.fetchedAt)

  return (
    <section className="border-b border-border-1 bg-bg-1">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full rounded-full bg-pos opacity-75"
                style={{ animation: 'phb-pulse 1.6s ease-in-out infinite' }}
              />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-pos" />
            </span>
            <span className="text-micro font-semibold uppercase tracking-wider text-pos">
              AO VIVO
            </span>
          </div>
          <span className="text-micro text-fg-3">
            {ago !== null
              ? `Última atualização há ${ago}s · CEPEA + Twelve Data`
              : 'CEPEA + Twelve Data'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <QuoteCell label="Soja" unit="R$" quote={data?.soja} accentClass="bg-grain-soja" />
          <QuoteCell label="Milho" unit="R$" quote={data?.milho} accentClass="bg-grain-milho" />
          <QuoteCell label="Trigo" unit="R$" quote={data?.trigo} accentClass="bg-grain-trigo" />
          <QuoteCell label="USD/BRL" unit="R$" quote={data?.usdbrl} accentClass="bg-grain-usd" />
        </div>
      </div>
    </section>
  )
}
