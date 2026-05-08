'use client'
import * as React from 'react'
import Link from 'next/link'
import { LineChart, Plus, ExternalLink } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  Tabs,
  Chip,
  Pill,
  Button,
  EmptyState,
  Skeleton,
} from '@/components/ui/phb'

const GRAINS = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
] as const

type Grao = (typeof GRAINS)[number]['value']

interface BookSide {
  price: number
  volumeSc: number
  count: number
  source?: string | null
}

interface VencimentoRow {
  ymd: string
  codigo: string
  vencimentoLabel: string
  bid: BookSide | null
  ask: BookSide | null
  spread: number | null
  spreadPct: number | null
}

interface BookB3Response {
  grao: string
  fonte: string
  unidade: string
  vencimentos: VencimentoRow[]
  totalRegistros: number
}

interface BookCBOTSide {
  price: number
  source: string
}

interface BookCBOTResponse {
  grao: string
  fonte: string
  unidade: string
  symbol: string
  marketState: string | null
  bid: BookCBOTSide | null
  ask: BookCBOTSide | null
  mid: number | null
  spread: number | null
  spreadPct: number | null
  fetchedAt?: string
  observacao?: string
  empty?: boolean
}

function fmtBRL(n: number | null | undefined, d = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtUSD(n: number | null | undefined, d = 4): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtVol(sc: number | null | undefined): string {
  if (sc === null || sc === undefined || !Number.isFinite(sc)) return '—'
  if (sc >= 1000) return `${(sc / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  return sc.toLocaleString('pt-BR')
}

export function FuturosBook() {
  const [grao, setGrao] = React.useState<Grao>('soja')
  const [b3, setB3] = React.useState<BookB3Response | null>(null)
  const [cbot, setCbot] = React.useState<BookCBOTResponse | null>(null)
  const [loading, setLoading] = React.useState(true)

  const fetchAll = React.useCallback(async (g: Grao) => {
    setLoading(true)
    try {
      const [b, c] = await Promise.all([
        fetch(`/api/futuros/book?grao=${g}`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
        fetch(`/api/futuros/cbot?grao=${g}`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
      ])
      setB3(b)
      setCbot(c)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchAll(grao)
    const id = setInterval(() => fetchAll(grao), 30_000)
    return () => clearInterval(id)
  }, [grao, fetchAll])

  const vencs = b3?.vencimentos || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Coluna esquerda: Book B3 próprio */}
      <Card className="lg:col-span-2 p-6">
        <CardHeader>
          <CardTitle eyebrow="MESA · BOOK DE FUTUROS B3">
            Book de Futuros · {GRAINS.find(g => g.value === grao)?.label}
          </CardTitle>
          <div className="flex items-center gap-3">
            <Tabs
              options={GRAINS as any}
              value={grao}
              onChange={(v) => setGrao(v as Grao)}
              size="sm"
            />
            <Link href="/futuros/novo">
              <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />}>
                Novo
              </Button>
            </Link>
          </div>
        </CardHeader>

        <p className="text-fg-3 text-small mb-4">
          {b3 ? `${b3.fonte} · ${b3.unidade}` : 'Carregando...'}
          {b3 && b3.totalRegistros > 0 ? (
            <span className="ml-2 text-fg-4">· {b3.totalRegistros} contratos agregados</span>
          ) : null}
        </p>

        {loading && !b3 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={48} />)}
          </div>
        ) : vencs.length === 0 ? (
          <EmptyState
            icon={LineChart}
            title="Sem contratos futuros ainda"
            description="Adicione seus primeiros contratos para visualizar o book agregado por vencimento."
            cta={
              <Link href="/futuros/novo">
                <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                  Adicionar contrato futuro
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-small">
              <thead>
                <tr className="text-fg-3 text-micro uppercase tracking-wider border-b border-border-1">
                  <th className="text-left py-2 px-2 font-semibold">Vencimento</th>
                  <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--pos)' }}>Compra</th>
                  <th className="text-right py-2 px-2 font-semibold text-fg-3">Vol</th>
                  <th className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--neg)' }}>Venda</th>
                  <th className="text-right py-2 px-2 font-semibold text-fg-3">Vol</th>
                  <th className="text-right py-2 px-2 font-semibold">Spread</th>
                </tr>
              </thead>
              <tbody>
                {vencs.map((v) => (
                  <tr
                    key={v.ymd}
                    className="border-b border-border-1 hover:bg-bg-3/40 transition-colors"
                  >
                    <td className="py-3 px-2">
                      <div className="flex flex-col">
                        <span className="text-fg-1 font-medium">{v.vencimentoLabel}</span>
                        <span className="text-micro text-fg-3 t-num">{v.codigo}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right t-num" style={{ color: 'var(--pos)' }}>
                      {v.bid ? fmtBRL(v.bid.price) : <span className="text-fg-4">—</span>}
                    </td>
                    <td className="py-3 px-2 text-right t-num text-fg-3">
                      {v.bid ? `${fmtVol(v.bid.volumeSc)} sc` : ''}
                    </td>
                    <td className="py-3 px-2 text-right t-num" style={{ color: 'var(--neg)' }}>
                      {v.ask ? fmtBRL(v.ask.price) : <span className="text-fg-4">—</span>}
                    </td>
                    <td className="py-3 px-2 text-right t-num text-fg-3">
                      {v.ask ? `${fmtVol(v.ask.volumeSc)} sc` : ''}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {v.spread !== null ? (
                        <div className="flex flex-col items-end">
                          <span className="t-num text-fg-2">{fmtBRL(v.spread)}</span>
                          {v.spreadPct !== null ? (
                            <span className="text-micro text-fg-3 t-num">{fmtBRL(v.spreadPct)}%</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-fg-4">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {vencs.length > 0 ? (
          <div className="mt-4 pt-4 border-t border-border-1 flex items-center justify-end">
            <Link
              href="/futuros"
              className="text-small text-fg-3 hover:text-accent flex items-center gap-1.5 transition-colors"
            >
              Gerenciar contratos
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : null}
      </Card>

      {/* Coluna direita: Referência CBOT */}
      <Card className="p-6">
        <CardHeader>
          <CardTitle eyebrow="REFERÊNCIA · INTERNACIONAL">
            Mercado CBOT
          </CardTitle>
          {cbot?.marketState ? (
            <Pill>
              <span
                className="h-1.5 w-1.5 rounded-pill"
                style={{ background: cbot.marketState === 'open' ? 'var(--pos)' : 'var(--neg)' }}
                aria-hidden="true"
              />
              <span className="ml-1.5 text-micro">
                {cbot.marketState === 'open' ? 'ABERTO' : 'FECHADO'}
              </span>
            </Pill>
          ) : null}
        </CardHeader>

        {loading && !cbot ? (
          <Skeleton height={180} />
        ) : !cbot || cbot.empty ? (
          <EmptyState
            icon={LineChart}
            title="CBOT temporariamente indisponível"
            description={cbot?.observacao || 'Rate limit ou mercado fechado.'}
          />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="eyebrow">{cbot.symbol} · NYSE (proxy CBOT)</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="t-num text-fg-3 text-body">USD</span>
                <span
                  className="t-num-lg"
                  style={{ color: 'var(--info)', fontSize: 36, lineHeight: 1.05 }}
                >
                  {fmtUSD(cbot.mid)}
                </span>
              </div>
              <p className="text-fg-3 text-small mt-1">
                {cbot.unidade}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border-1">
              <div>
                <p className="eyebrow" style={{ color: 'var(--pos)' }}>BID</p>
                <p className="t-num text-fg-1 text-body font-medium mt-0.5">
                  {fmtUSD(cbot.bid?.price)}
                </p>
              </div>
              <div>
                <p className="eyebrow" style={{ color: 'var(--neg)' }}>ASK</p>
                <p className="t-num text-fg-1 text-body font-medium mt-0.5">
                  {fmtUSD(cbot.ask?.price)}
                </p>
              </div>
              <div>
                <p className="eyebrow">SPREAD</p>
                <p className="t-num text-fg-2 text-small mt-0.5">
                  {fmtUSD(cbot.spread)}{' '}
                  {cbot.spreadPct !== null ? (
                    <span className="text-fg-3">({fmtBRL(cbot.spreadPct)}%)</span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="eyebrow">FONTE</p>
                <p className="text-fg-3 text-micro mt-0.5">via Teucrium ETF</p>
              </div>
            </div>

            {cbot.observacao ? (
              <p className="text-micro text-fg-4 leading-snug">
                {cbot.observacao}
              </p>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  )
}
