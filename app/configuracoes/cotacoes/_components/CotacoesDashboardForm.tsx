'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react'

interface Group {
  category: string
  label: string
  items: { id: string; name: string }[]
}

interface Props {
  canEdit: boolean
  initialSelected: string[]
  isCustom: boolean
  defaultIds: string[]
  grouped: Group[]
}

export function CotacoesDashboardForm({
  canEdit,
  initialSelected,
  isCustom,
  defaultIds,
  grouped,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected))
  const [custom, setCustom] = useState(isCustom)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const toggle = (id: string) => {
    setSelected((curr) => {
      const next = new Set(curr)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGroup = (items: { id: string }[]) => {
    setSelected((curr) => {
      const next = new Set(curr)
      const allOn = items.every((i) => next.has(i.id))
      if (allOn) items.forEach((i) => next.delete(i.id))
      else items.forEach((i) => next.add(i.id))
      return next
    })
  }

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const ids = Array.from(selected)
      const res = await fetch('/api/workspaces/dashboard-symbols', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar.')
      setSuccess('Lista salva. Volte ao dashboard para ver.')
      setCustom(true)
    } catch (e: any) {
      setError(e?.message || 'erro')
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Voltar para a lista padrão do sistema?')) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/workspaces/dashboard-symbols', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Falha ao resetar.')
      setSelected(new Set(defaultIds))
      setCustom(false)
      setSuccess('Lista resetada ao padrão.')
    } catch (e: any) {
      setError(e?.message || 'erro')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between p-3 rounded border border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-700">
          {selected.size} commodities selecionadas {custom ? '· lista personalizada' : '· lista padrão'}
        </div>
        {custom && canEdit ? (
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded border border-gray-300"
          >
            <RotateCcw className="w-3 h-3" />
            Resetar ao padrão
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-2 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {success ? (
        <div className="flex items-start gap-2 p-3 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      <fieldset disabled={!canEdit || busy} className="space-y-4 disabled:opacity-60">
        {grouped.map((g) => {
          const allOn = g.items.every((i) => selected.has(i.id))
          const someOn = g.items.some((i) => selected.has(i.id))
          return (
            <div key={g.category} className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">{g.label}</h3>
                <button
                  type="button"
                  onClick={() => toggleGroup(g.items)}
                  className="text-xs text-gray-600 hover:text-gray-900 underline"
                >
                  {allOn ? 'Desmarcar todos' : someOn ? 'Marcar todos' : 'Marcar todos'}
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-4">
                {g.items.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                    <span className="text-gray-800">{item.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !canEdit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0a8a3a] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Salvando…' : `Salvar (${selected.size} commodities)`}
          </button>
          {!canEdit ? (
            <span className="text-xs text-gray-500">
              Apenas owner/admin pode alterar.
            </span>
          ) : null}
        </div>
      </fieldset>
    </div>
  )
}
