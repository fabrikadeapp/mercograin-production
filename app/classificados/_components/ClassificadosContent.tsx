'use client'
import * as React from 'react'
import Link from 'next/link'
import { ChevronDown, Eye, MapPin, MessageCircle, MoreHorizontal, Plus, Sprout } from 'lucide-react'
import {
  Card,
  Tabs,
  Pill,
  Chip,
  Button,
  IconButton,
  GrainBadge,
  EmptyState,
  Skeleton,
  ErrorBanner,
} from '@/components/ui/phb'

const KIND_TABS = [
  { value: 'todas', label: 'Todas' },
  { value: 'comprar', label: 'Comprar' },
  { value: 'vender', label: 'Vender' },
]

const GRAINS = ['soja', 'milho', 'trigo'] as const

function ageLabel(criadoEm: string | Date): string {
  const ms = Date.now() - new Date(criadoEm).getTime()
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return 'AGORA'
  if (h < 24) return `HÁ ${h}H`
  return `HÁ ${Math.floor(h / 24)}D`
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface ApiClassificado {
  id: string
  tipo: 'venda' | 'compra'
  grao: string
  variedade: string | null
  safra: string | null
  volumeSc: number
  precoSc: number | string
  modal: string
  cidade: string
  uf: string
  deltaPct: number | string | null
  criadoEm: string
}

function ClassifiedCardView({ card }: { card: ApiClassificado }) {
  const tipoVenda = card.tipo === 'venda'
  const delta = card.deltaPct !== null && card.deltaPct !== undefined ? Number(card.deltaPct) : null
  const trend: 'pos' | 'neg' = (delta ?? 0) >= 0 ? 'pos' : 'neg'

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        {tipoVenda ? (
          <Pill style={{ background: 'color-mix(in srgb, var(--pos) 18%, transparent)', color: 'var(--pos)' }}>VENDA</Pill>
        ) : (
          <Pill style={{ background: 'color-mix(in srgb, var(--info) 18%, transparent)', color: 'var(--info)' }}>COMPRA</Pill>
        )}
        <span className="eyebrow">{ageLabel(card.criadoEm)}</span>
      </div>
      <div className="space-y-1">
        <h3 className="text-h3 text-fg-1">
          {capitalize(card.grao)}
          {card.variedade ? ` · ${card.variedade}` : ''}
          {card.safra ? ` · Safra ${card.safra}` : ''}
        </h3>
        <p className="flex items-center gap-1.5 text-fg-3 text-small">
          <MapPin className="h-3.5 w-3.5" />
          {card.cidade} · {card.uf}
        </p>
      </div>
      <div className="bg-bg-inset rounded-md p-3 grid grid-cols-3 gap-2">
        <div className="space-y-0.5">
          <p className="eyebrow">VOLUME</p>
          <p className="t-num text-fg-1 text-small">{card.volumeSc.toLocaleString('pt-BR')} sc</p>
        </div>
        <div className="space-y-0.5">
          <p className="eyebrow">PREÇO</p>
          <p className="t-num text-fg-1 text-small">R$ {fmtBRL(Number(card.precoSc))}</p>
        </div>
        <div className="space-y-0.5">
          <p className="eyebrow">MODAL</p>
          <div className="flex items-center gap-1.5">
            <span className="text-fg-1 text-small">{card.modal}</span>
            {delta !== null && <Chip variant={trend}>{`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`}</Chip>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button leftIcon={<MessageCircle className="h-4 w-4" />} className="flex-1">Negociar</Button>
        <IconButton aria-label="Visualizar"><Eye className="h-4 w-4" /></IconButton>
        <IconButton aria-label="Mais opções"><MoreHorizontal className="h-4 w-4" /></IconButton>
      </div>
    </Card>
  )
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

async function safeJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json()
}

export function ClassificadosContent() {
  const [kind, setKind] = React.useState('todas')
  const [grains, setGrains] = React.useState<Set<string>>(new Set())
  const [items, setItems] = React.useState<ApiClassificado[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  function toggleGrain(g: string) {
    setGrains((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g); else next.add(g)
      return next
    })
  }

  React.useEffect(() => {
    let cancel = false
    const params = new URLSearchParams()
    if (kind !== 'todas') params.set('tipo', kind)
    const grainList = Array.from(grains)
    if (grainList.length === 1) params.set('grao', grainList[0])
    safeJson(`/api/classificados?${params.toString()}`)
      .then((d) => { if (!cancel) setItems(d.data) })
      .catch((e) => !cancel && setError(String(e)))
    return () => { cancel = true }
  }, [kind, grains])

  if (error) return <ErrorBanner message={error} />

  const filtered = grains.size > 1
    ? (items || []).filter((c) => grains.has(c.grao))
    : items || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Tabs options={KIND_TABS} value={kind} onChange={setKind} size="sm" />
          <div className="flex items-center gap-2">
            {GRAINS.map((g) => (
              <button key={g} type="button" onClick={() => toggleGrain(g)} className="focus:outline-none" aria-pressed={grains.has(g)}>
                <GrainBadge variant={g} className={grains.has(g) ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg-0' : ''} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Pill>Ordenar por: Mais recentes <ChevronDown className="h-3.5 w-3.5 ml-1.5" /></Pill>
          <Link href="/classificados/novo">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Anunciar lote</Button>
          </Link>
        </div>
      </div>

      {!items ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={280} rounded="lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="Nenhum lote anunciado"
          description="Anuncie o primeiro lote para começar a negociar com o marketplace BH."
          cta={
            <Link href="/classificados/novo">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Anunciar lote</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => <ClassifiedCardView key={c.id} card={c} />)}
        </div>
      )}
    </div>
  )
}
