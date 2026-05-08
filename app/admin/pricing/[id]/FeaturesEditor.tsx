'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { GripVertical, Plus, Trash2, Check, X } from 'lucide-react'
import { Card, Button, Input } from '@/components/ui/phb'
import type { SerializedFeature } from '@/lib/pricing/serialize'

interface Props {
  planId: string
  initialFeatures: SerializedFeature[]
}

export function FeaturesEditor({ planId, initialFeatures }: Props) {
  const router = useRouter()
  const [features, setFeatures] = React.useState<SerializedFeature[]>(initialFeatures)
  const [newLabel, setNewLabel] = React.useState('')
  const [newIncluded, setNewIncluded] = React.useState(true)
  const [draggingId, setDraggingId] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    setFeatures(initialFeatures)
  }, [initialFeatures])

  async function persistOrder(next: SerializedFeature[]) {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/pricing/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'feature',
          items: next.map((f, i) => ({ id: f.id, sortOrder: i })),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
    } catch (err) {
      console.error('[reorder features]', err)
      alert('Falha ao reordenar features.')
      setFeatures(initialFeatures)
    } finally {
      setBusy(false)
    }
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!draggingId || draggingId === targetId) return
    const fromIdx = features.findIndex((f) => f.id === draggingId)
    const toIdx = features.findIndex((f) => f.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = features.slice()
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setFeatures(next)
    setDraggingId(null)
    void persistOrder(next)
  }

  async function addFeature() {
    if (!newLabel.trim()) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/admin/pricing/plans/${planId}/features`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: newLabel.trim(),
            included: newIncluded,
            emphasis: false,
          }),
        }
      )
      if (!res.ok) throw new Error(await res.text())
      setNewLabel('')
      setNewIncluded(true)
      router.refresh()
    } catch (err) {
      console.error('[add feature]', err)
      alert('Falha ao adicionar feature.')
    } finally {
      setBusy(false)
    }
  }

  async function patchFeature(id: string, patch: Partial<SerializedFeature>) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/pricing/features/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
    } catch (err) {
      console.error('[patch feature]', err)
      alert('Falha ao atualizar feature.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteFeature(id: string) {
    if (!confirm('Excluir esta feature?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/pricing/features/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
    } catch (err) {
      console.error('[delete feature]', err)
      alert('Falha ao excluir feature.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-end gap-3">
          <Input
            containerClassName="flex-1"
            label="Nova feature"
            placeholder="ex: API REST"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addFeature()
              }
            }}
          />
          <label className="inline-flex items-center gap-2 mb-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newIncluded}
              onChange={(e) => setNewIncluded(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span className="text-small text-fg-2">Incluída</span>
          </label>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={busy || !newLabel.trim()}
            onClick={addFeature}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Adicionar
          </Button>
        </div>
      </Card>

      {features.length === 0 ? (
        <Card className="p-8 text-center text-fg-3">
          Nenhuma feature ainda. Adicione a primeira acima.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {features.map((f) => (
            <Card
              key={f.id}
              draggable
              onDragStart={(e) => onDragStart(e, f.id)}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, f.id)}
              className={
                'p-3 flex items-center gap-3 transition-opacity ' +
                (draggingId === f.id ? 'opacity-50' : '')
              }
            >
              <div
                className="cursor-grab active:cursor-grabbing text-fg-3 hover:text-fg-1"
                aria-label="Arrastar"
              >
                <GripVertical className="h-4 w-4" />
              </div>

              <input
                defaultValue={f.label}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== f.label) {
                    void patchFeature(f.id, { label: e.target.value.trim() })
                  }
                }}
                className="flex-1 bg-transparent text-fg-1 text-body outline-none focus:bg-bg-2 px-2 h-9 rounded-md border border-transparent focus:border-border-2"
              />

              <button
                type="button"
                onClick={() => patchFeature(f.id, { included: !f.included })}
                disabled={busy}
                className={
                  'inline-flex items-center gap-1 px-3 py-1 rounded-pill text-micro font-semibold border ' +
                  (f.included
                    ? 'bg-pos/15 text-pos border-pos/40'
                    : 'bg-neg/10 text-neg border-neg/40')
                }
                title="Incluída no plano? (clique pra alternar)"
              >
                {f.included ? (
                  <>
                    <Check className="h-3 w-3" />
                    Incluída
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3" />
                    Não inclusa
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => patchFeature(f.id, { emphasis: !f.emphasis })}
                disabled={busy}
                className={
                  'px-3 py-1 rounded-pill text-micro font-semibold border ' +
                  (f.emphasis
                    ? 'bg-accent/15 text-accent border-accent/40'
                    : 'bg-bg-2 text-fg-3 border-border-1 hover:bg-bg-3')
                }
                title="Destaque visual da feature"
              >
                {f.emphasis ? '★ Destaque' : '☆ Normal'}
              </button>

              <button
                type="button"
                onClick={() => deleteFeature(f.id)}
                disabled={busy}
                className="p-2 rounded-md text-fg-3 hover:text-neg hover:bg-neg/10"
                title="Excluir feature"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
