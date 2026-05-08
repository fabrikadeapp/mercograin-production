'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { Card, Button, Chip } from '@/components/ui/phb'
import type { SerializedPlan } from '@/lib/pricing/serialize'

interface Props {
  initialPlans: SerializedPlan[]
}

export function PlansList({ initialPlans }: Props) {
  const router = useRouter()
  const [plans, setPlans] = React.useState<SerializedPlan[]>(initialPlans)
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    setPlans(initialPlans)
  }, [initialPlans])

  function onDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  async function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!draggingId || draggingId === targetId) return
    const fromIdx = plans.findIndex((p) => p.id === draggingId)
    const toIdx = plans.findIndex((p) => p.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = plans.slice()
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setPlans(next)
    setDraggingId(null)

    // persiste sortOrder = index
    setBusy(true)
    try {
      const res = await fetch('/api/admin/pricing/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'plan',
          items: next.map((p, i) => ({ id: p.id, sortOrder: i })),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
    } catch (err) {
      console.error('[reorder plans]', err)
      alert('Falha ao reordenar planos.')
      setPlans(initialPlans)
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(plan: SerializedPlan) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/pricing/plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !plan.active }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
    } catch (err) {
      console.error('[toggle active]', err)
      alert('Falha ao alterar status do plano.')
    } finally {
      setBusy(false)
    }
  }

  async function deletePlan(plan: SerializedPlan) {
    if (
      !confirm(
        `Arquivar plano "${plan.shortName}"?\n\nO plano será marcado como inativo no banco e arquivado no Stripe. Assinaturas existentes continuam funcionando.`
      )
    ) {
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/pricing/plans/${plan.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
    } catch (err) {
      console.error('[delete plan]', err)
      alert('Falha ao arquivar plano.')
    } finally {
      setBusy(false)
    }
  }

  if (plans.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-fg-2 text-body">Nenhum plano cadastrado.</p>
        <Link href="/admin/pricing/novo" className="mt-4 inline-block">
          <Button variant="primary" size="md">
            + Criar primeiro plano
          </Button>
        </Link>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {plans.map((plan, idx) => (
        <Card
          key={plan.id}
          draggable
          onDragStart={(e) => onDragStart(e, plan.id)}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, plan.id)}
          className={
            'p-5 flex items-center gap-4 transition-opacity ' +
            (draggingId === plan.id ? 'opacity-50' : '') +
            (plan.active ? '' : ' opacity-60')
          }
        >
          <div
            className="cursor-grab active:cursor-grabbing text-fg-3 hover:text-fg-1"
            aria-label="Arrastar para reordenar"
          >
            <GripVertical className="h-5 w-5" />
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-fg-1 text-h3 font-semibold">
                {plan.shortName}
              </span>
              <span className="text-fg-3 text-micro font-mono">{plan.slug}</span>
              {plan.badge ? (
                <Chip variant="accent">{plan.badge}</Chip>
              ) : null}
              {plan.highlight ? <Chip variant="warn">Destaque</Chip> : null}
              {!plan.active ? <Chip variant="neg">Inativo</Chip> : null}
            </div>
            <div className="text-fg-3 text-small mt-1">
              {plan.tagline ?? plan.name}
            </div>
            <div className="text-fg-2 text-small mt-2">
              <span className="text-accent font-mono tabular-nums">
                {plan.priceFormatted}
              </span>
              <span className="text-fg-3 ml-1">{plan.intervalLabel}</span>
              <span className="text-fg-3 mx-2">·</span>
              <span>{plan.includedFeatures.length} features incluídas</span>
              {plan.stripePriceId ? (
                <>
                  <span className="text-fg-3 mx-2">·</span>
                  <span className="font-mono text-micro">
                    {plan.stripePriceId}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-fg-3 mx-2">·</span>
                  <span className="text-warn font-medium">
                    sem Stripe price
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-micro font-mono text-fg-3 px-2 py-1 rounded-pill bg-bg-2 border border-border-1"
              title="sortOrder"
            >
              #{idx + 1}
            </span>
            <button
              type="button"
              onClick={() => toggleActive(plan)}
              disabled={busy}
              className={
                'px-3 py-1.5 rounded-md text-micro font-semibold border transition-colors ' +
                (plan.active
                  ? 'bg-bg-2 text-fg-2 border-border-1 hover:bg-bg-3'
                  : 'bg-pos/20 text-pos border-pos/40 hover:bg-pos/30')
              }
            >
              {plan.active ? 'Ativo' : 'Inativo'}
            </button>
            <Link href={`/admin/pricing/${plan.id}`}>
              <Button variant="ghost" size="sm">
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => deletePlan(plan)}
              disabled={busy}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-micro font-semibold text-neg border border-neg/40 bg-neg/10 hover:bg-neg/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Arquivar
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}
