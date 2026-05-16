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
      <div
        className="flex items-center justify-between p-3"
        style={{
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
        }}
      >
        <div className="text-sm" style={{ color: 'var(--text)' }}>
          {selected.size} commodities selecionadas{' '}
          <span style={{ color: 'var(--text-mute)' }}>
            · {custom ? 'lista personalizada' : 'lista padrão'}
          </span>
        </div>
        {custom && canEdit ? (
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="btn ghost"
            style={{ fontSize: 11, padding: '5px 10px' }}
          >
            <RotateCcw className="w-3 h-3" />
            Resetar ao padrão
          </button>
        ) : null}
      </div>

      {error ? (
        <div
          className="flex items-start gap-2 p-3 text-sm"
          style={{
            borderRadius: 'var(--r-md)',
            background: 'var(--danger-soft)',
            border: '1px solid rgba(248, 113, 113, 0.25)',
            color: 'var(--danger)',
          }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {success ? (
        <div
          className="flex items-start gap-2 p-3 text-sm"
          style={{
            borderRadius: 'var(--r-md)',
            background: 'var(--success-soft)',
            border: '1px solid rgba(74, 222, 128, 0.25)',
            color: 'var(--success)',
          }}
        >
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      <fieldset disabled={!canEdit || busy} className="space-y-4 disabled:opacity-60">
        {grouped.map((g) => {
          const allOn = g.items.every((i) => selected.has(i.id))
          const someOn = g.items.some((i) => selected.has(i.id))
          return (
            <div
              key={g.category}
              style={{
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)',
                background: 'var(--surface-1)',
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {g.label}
                </h3>
                <button
                  type="button"
                  onClick={() => toggleGroup(g.items)}
                  className="text-xs underline transition"
                  style={{ color: 'var(--text-mute)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-mute)')}
                >
                  {allOn ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-4">
                {g.items.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition"
                    style={{ color: 'var(--text)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tint-4pct)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span>{item.name}</span>
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
            className="btn primary"
            style={{ fontSize: 13 }}
          >
            {busy ? 'Salvando…' : `Salvar (${selected.size} commodities)`}
          </button>
          {!canEdit ? (
            <span className="text-xs" style={{ color: 'var(--text-mute)' }}>
              Apenas owner/admin pode alterar.
            </span>
          ) : null}
        </div>
      </fieldset>
    </div>
  )
}
