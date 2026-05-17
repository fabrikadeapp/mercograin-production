'use client'

import { useState, useTransition } from 'react'
import { Lock, Check } from 'lucide-react'

interface CatalogItem {
  label: string
  description: string
  core: boolean
  default: boolean
}

interface Props {
  workspaceId: string
  catalog: Record<string, CatalogItem>
  initial: Record<string, boolean>
}

export function FeaturesToggleList({ workspaceId, catalog, initial }: Props) {
  const [state, setState] = useState<Record<string, boolean>>(initial)
  const [pending, startTransition] = useTransition()
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const toggle = (key: string, enabled: boolean) => {
    setErr(null)
    setState((s) => ({ ...s, [key]: enabled }))
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/workspaces/${workspaceId}/features`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feature: key, enabled }),
        },
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErr(j.error || 'Erro ao salvar')
        // revert
        setState((s) => ({ ...s, [key]: !enabled }))
        return
      }
      setSavedKey(key)
      setTimeout(() => setSavedKey(null), 1500)
    })
  }

  const cores = Object.entries(catalog).filter(([_, c]) => c.core)
  const optional = Object.entries(catalog).filter(([_, c]) => !c.core)

  return (
    <div className="space-y-6">
      {err && (
        <div
          style={{
            padding: 12,
            background: 'rgba(255,80,80,0.1)',
            border: '1px solid var(--danger, #ff5050)',
            borderRadius: 8,
            color: 'var(--danger, #ff5050)',
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}

      <section>
        <h2
          style={{
            fontSize: 13,
            fontFamily: 'var(--f-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-dim)',
            marginBottom: 10,
          }}
        >
          Módulos core (sempre ativos)
        </h2>
        <div className="space-y-2">
          {cores.map(([key, c]) => (
            <FeatureRow
              key={key}
              fkey={key}
              catalog={c}
              enabled={true}
              locked
              saved={false}
              pending={false}
              onToggle={() => {}}
            />
          ))}
        </div>
      </section>

      <section>
        <h2
          style={{
            fontSize: 13,
            fontFamily: 'var(--f-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-dim)',
            marginBottom: 10,
          }}
        >
          Módulos opcionais (add-ons)
        </h2>
        <div className="space-y-2">
          {optional.map(([key, c]) => (
            <FeatureRow
              key={key}
              fkey={key}
              catalog={c}
              enabled={state[key] ?? c.default}
              locked={false}
              saved={savedKey === key}
              pending={pending}
              onToggle={(v) => toggle(key, v)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function FeatureRow({
  fkey,
  catalog,
  enabled,
  locked,
  saved,
  pending,
  onToggle,
}: {
  fkey: string
  catalog: CatalogItem
  enabled: boolean
  locked: boolean
  saved: boolean
  pending: boolean
  onToggle: (enabled: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'var(--surface-1, rgba(255,255,255,0.02))',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          {locked && (
            <Lock className="w-3 h-3" style={{ color: 'var(--text-dim)' }} />
          )}
          <span style={{ fontSize: 14, fontWeight: 600 }}>{catalog.label}</span>
          <code
            style={{
              fontSize: 10,
              fontFamily: 'var(--f-mono)',
              color: 'var(--text-dim)',
              background: 'var(--surface-2)',
              padding: '1px 6px',
              borderRadius: 4,
            }}
          >
            {fkey}
          </code>
          {saved && (
            <Check className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-mute)', margin: 0 }}>
          {catalog.description}
        </p>
      </div>
      <div style={{ flexShrink: 0 }}>
        <Switch
          checked={enabled}
          disabled={locked || pending}
          onChange={onToggle}
        />
      </div>
    </div>
  )
}

function Switch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        background: checked ? 'var(--accent)' : 'var(--surface-2)',
        border: '1px solid var(--border)',
        position: 'relative',
        transition: 'background 0.15s',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: checked ? 'var(--accent-ink)' : 'var(--text)',
          transition: 'left 0.15s',
        }}
      />
    </button>
  )
}
