'use client'
import * as React from 'react'
import { ChevronDown, Eye, MapPin, MessageCircle, MoreHorizontal } from 'lucide-react'
import {
  Card,
  Tabs,
  Pill,
  Chip,
  Button,
  IconButton,
  GrainBadge,
} from '@/components/ui/phb'
import { CLASSIFIEDS, type ClassifiedCard } from '@/lib/mocks/phb'

const KIND_TABS = [
  { value: 'todas', label: 'Todas' },
  { value: 'comprar', label: 'Comprar' },
  { value: 'vender', label: 'Vender' },
]

const GRAINS = ['soja', 'milho', 'trigo'] as const

function ClassifiedCardView({ card }: { card: ClassifiedCard }) {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        {card.kind === 'venda' ? (
          <Pill style={{ background: 'color-mix(in srgb, var(--pos) 18%, transparent)', color: 'var(--pos)' }}>
            VENDA
          </Pill>
        ) : (
          <Pill style={{ background: 'color-mix(in srgb, var(--info) 18%, transparent)', color: 'var(--info)' }}>
            COMPRA
          </Pill>
        )}
        <span className="eyebrow">{card.age}</span>
      </div>
      <div className="space-y-1">
        <h3 className="text-h3 text-fg-1">{card.title}</h3>
        <p className="flex items-center gap-1.5 text-fg-3 text-small">
          <MapPin className="h-3.5 w-3.5" />
          {card.location}
        </p>
      </div>
      <div className="bg-bg-inset rounded-md p-3 grid grid-cols-3 gap-2">
        <div className="space-y-0.5">
          <p className="eyebrow">VOLUME</p>
          <p className="t-num text-fg-1 text-small">{card.volume}</p>
        </div>
        <div className="space-y-0.5">
          <p className="eyebrow">PREÇO</p>
          <p className="t-num text-fg-1 text-small">{card.price}</p>
        </div>
        <div className="space-y-0.5">
          <p className="eyebrow">MODAL</p>
          <div className="flex items-center gap-1.5">
            <span className="text-fg-1 text-small">{card.modal}</span>
            <Chip variant={card.delta.trend}>{card.delta.value}</Chip>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button leftIcon={<MessageCircle className="h-4 w-4" />} className="flex-1">
          Negociar
        </Button>
        <IconButton aria-label="Visualizar">
          <Eye className="h-4 w-4" />
        </IconButton>
        <IconButton aria-label="Mais opções">
          <MoreHorizontal className="h-4 w-4" />
        </IconButton>
      </div>
    </Card>
  )
}

export function ClassificadosContent() {
  const [kind, setKind] = React.useState('todas')
  const [grains, setGrains] = React.useState<Set<string>>(new Set())

  function toggleGrain(g: string) {
    setGrains((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Tabs options={KIND_TABS} value={kind} onChange={setKind} size="sm" />
          <div className="flex items-center gap-2">
            {GRAINS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggleGrain(g)}
                className="focus:outline-none"
                aria-pressed={grains.has(g)}
              >
                <GrainBadge
                  variant={g}
                  className={grains.has(g) ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg-0' : ''}
                />
              </button>
            ))}
          </div>
        </div>
        <Pill>
          Ordenar por: Mais recentes
          <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
        </Pill>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CLASSIFIEDS.map((c, i) => (
          <ClassifiedCardView key={i} card={c} />
        ))}
      </div>
    </div>
  )
}
