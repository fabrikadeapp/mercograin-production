'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2 } from 'lucide-react'
import { Button, Card, Input, Select } from '@/components/ui/phb'
import { parseBRLToCents, formatBRL } from '@/lib/pricing/format'

export interface PlanFormValues {
  slug: string
  name: string
  tagline: string
  description: string
  badge: string
  highlight: boolean
  priceCents: number
  currency: string
  billingInterval: 'day' | 'week' | 'month' | 'year'
  intervalCount: number
  trialDays: number
  ctaLabel: string
  ctaHref: string
  sortOrder: number
  active: boolean
}

interface Props {
  initial?: Partial<PlanFormValues>
  /** 'create' → POST /plans ; 'update' → PUT /plans/[id] */
  mode: 'create' | 'update'
  planId?: string
  onSaved?: (planId: string) => void
}

const DEFAULTS: PlanFormValues = {
  slug: '',
  name: '',
  tagline: '',
  description: '',
  badge: '',
  highlight: false,
  priceCents: 0,
  currency: 'BRL',
  billingInterval: 'month',
  intervalCount: 1,
  trialDays: 10,
  ctaLabel: 'Iniciar trial',
  ctaHref: '',
  sortOrder: 0,
  active: true,
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

export function PlanForm({ initial, mode, planId, onSaved }: Props) {
  const router = useRouter()
  const [v, setV] = React.useState<PlanFormValues>({ ...DEFAULTS, ...initial })
  const [priceInput, setPriceInput] = React.useState<string>(
    initial?.priceCents != null ? formatBRL(initial.priceCents) : ''
  )
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [stripeWarn, setStripeWarn] = React.useState<string | null>(null)
  const slugTouched = React.useRef(mode === 'update')

  function update<K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) {
    setV((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setStripeWarn(null)

    const cents = parseBRLToCents(priceInput) || v.priceCents
    if (!v.slug || !v.name) {
      setError('slug e nome são obrigatórios.')
      return
    }
    if (cents <= 0) {
      setError('Informe um preço válido.')
      return
    }

    const payload = {
      slug: v.slug,
      name: v.name,
      tagline: v.tagline || null,
      description: v.description || null,
      badge: v.badge || null,
      highlight: v.highlight,
      priceCents: cents,
      currency: v.currency,
      billingInterval: v.billingInterval,
      intervalCount: v.intervalCount,
      trialDays: v.trialDays,
      ctaLabel: v.ctaLabel,
      ctaHref: v.ctaHref || null,
      sortOrder: v.sortOrder,
      active: v.active,
    }

    setBusy(true)
    try {
      const url =
        mode === 'create'
          ? '/api/admin/pricing/plans'
          : `/api/admin/pricing/plans/${planId}`
      const method = mode === 'create' ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || 'Falha ao salvar plano.')
        return
      }
      if (json?.stripeError) {
        setStripeWarn(`Plano salvo, mas Stripe falhou: ${json.stripeError}`)
      }
      const id = json?.plan?.id || planId
      if (onSaved && id) onSaved(id)
      else if (mode === 'create' && id) {
        router.push(`/admin/pricing/${id}`)
      } else {
        router.refresh()
      }
    } catch (err: any) {
      setError(err?.message || 'Erro de rede.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? (
        <Card className="p-4 border-neg/50 bg-neg/10 text-neg text-small">
          {error}
        </Card>
      ) : null}
      {stripeWarn ? (
        <Card className="p-4 border-warn/50 bg-warn/10 text-warn text-small">
          {stripeWarn}
        </Card>
      ) : null}

      <Card className="p-5 space-y-4">
        <h3 className="eyebrow">Identificação</h3>

        <Input
          label="Nome (exibido)"
          value={v.name}
          onChange={(e) => {
            const nv = e.target.value
            update('name', nv)
            if (!slugTouched.current) update('slug', slugify(nv))
          }}
          placeholder="ex: PHB Grain · Pro"
          required
        />

        <Input
          label="Slug (URL/Stripe metadata)"
          value={v.slug}
          onChange={(e) => {
            slugTouched.current = true
            update('slug', slugify(e.target.value))
          }}
          placeholder="ex: pro"
          helperText="a-z, 0-9 e hífen. Imutável após criação evita quebrar metadata Stripe."
          required
        />

        <Input
          label="Tagline"
          value={v.tagline}
          onChange={(e) => update('tagline', e.target.value)}
          placeholder="ex: Para mesas com até 5 traders"
        />

        <div>
          <label className="eyebrow mb-1.5 block">Descrição</label>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-border-1 bg-bg-2 text-fg-1 text-body p-3 outline-none focus:ring-2 focus:ring-accent"
            value={v.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Texto opcional para o Stripe Product."
          />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="eyebrow">Preço & cobrança</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Preço"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            onBlur={(e) => {
              const c = parseBRLToCents(e.target.value)
              if (c > 0) {
                update('priceCents', c)
                setPriceInput(formatBRL(c, v.currency))
              }
            }}
            placeholder="R$ 297,00"
            leftIcon={<span className="text-fg-3 text-small">R$</span>}
            required
          />
          <Select
            label="Moeda"
            value={v.currency}
            onChange={(e) => update('currency', e.target.value)}
            options={[
              { value: 'BRL', label: 'BRL' },
              { value: 'USD', label: 'USD' },
            ]}
          />
          <Select
            label="Intervalo"
            value={v.billingInterval}
            onChange={(e) =>
              update(
                'billingInterval',
                e.target.value as PlanFormValues['billingInterval']
              )
            }
            options={[
              { value: 'day', label: 'Diário' },
              { value: 'week', label: 'Semanal' },
              { value: 'month', label: 'Mensal' },
              { value: 'year', label: 'Anual' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="A cada N intervalos"
            type="number"
            min={1}
            value={v.intervalCount}
            onChange={(e) => update('intervalCount', Math.max(1, Number(e.target.value) || 1))}
            helperText='1 = mensal padrão; 3 = trimestral'
          />
          <Input
            label="Trial (dias)"
            type="number"
            min={0}
            value={v.trialDays}
            onChange={(e) => update('trialDays', Math.max(0, Number(e.target.value) || 0))}
          />
          <Input
            label="Sort order"
            type="number"
            value={v.sortOrder}
            onChange={(e) => update('sortOrder', Number(e.target.value) || 0)}
            helperText="Use o drag & drop pra ordenar; este campo só refina."
          />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="eyebrow">Apresentação & CTA</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Badge (texto ou vazio)"
            value={v.badge}
            onChange={(e) => update('badge', e.target.value)}
            placeholder="ex: MAIS POPULAR"
          />
          <div className="flex flex-col gap-2 justify-end">
            <label className="inline-flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={v.highlight}
                onChange={(e) => update('highlight', e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span className="text-body text-fg-1">Destaque visual no card</span>
            </label>
            <label className="inline-flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={v.active}
                onChange={(e) => update('active', e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span className="text-body text-fg-1">Plano ativo</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="CTA label"
            value={v.ctaLabel}
            onChange={(e) => update('ctaLabel', e.target.value)}
            placeholder="ex: Iniciar trial · Pro"
          />
          <Input
            label="CTA href (opcional)"
            value={v.ctaHref}
            onChange={(e) => update('ctaHref', e.target.value)}
            placeholder={`vazio → /auth/signup?plan=${v.slug || 'slug'}`}
            helperText="Use /contato pra Enterprise, por exemplo."
          />
        </div>
      </Card>

      <div className="flex items-center gap-3 justify-end">
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={busy}
          leftIcon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
          {mode === 'create' ? 'Criar plano' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  )
}
