'use client'

import { useEffect, useState } from 'react'
import { Loader2, Lock, Power, PowerOff } from 'lucide-react'

interface Feature {
  key: string
  label: string
  description: string
  core: boolean
  enabled: boolean
  toggledAt: string | null
  toggledBy: string | null
}

export function SystemFeaturesView() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function load() {
    const r = await fetch('/api/admin/system-features')
    const j = await r.json().catch(() => ({}))
    if (r.ok) setFeatures(j.features ?? [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  async function toggle(key: string, enabled: boolean) {
    setSavingKey(key)
    setErro(null)
    try {
      const r = await fetch('/api/admin/system-features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: key, enabled }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(j.error ?? 'erro')
      } else {
        await load()
      }
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Carregando…
      </div>
    )
  }

  const core = features.filter((f) => f.core)
  const opt = features.filter((f) => !f.core)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Features globais</h1>
        <p className="text-sm text-gray-600 mt-1">
          Kill-switches globais. Quando uma feature está <strong>OFF</strong> aqui,
          nenhum workspace consegue ligá-la — mesmo que o admin do workspace tente.
        </p>
        {erro && (
          <div className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{erro}</div>
        )}
      </header>

      <section>
        <h2 className="text-sm font-medium uppercase text-gray-500 mb-3">
          Opcionais (super-admin controla)
        </h2>
        <div className="space-y-2">
          {opt.map((f) => (
            <FeatureRow
              key={f.key}
              feature={f}
              busy={savingKey === f.key}
              onToggle={(v) => toggle(f.key, v)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase text-gray-500 mb-3">Core (sempre on)</h2>
        <div className="space-y-2">
          {core.map((f) => (
            <FeatureRow key={f.key} feature={f} busy={false} onToggle={() => undefined} />
          ))}
        </div>
      </section>
    </div>
  )
}

function FeatureRow({
  feature,
  busy,
  onToggle,
}: {
  feature: Feature
  busy: boolean
  onToggle: (v: boolean) => void
}) {
  const dt = feature.toggledAt ? new Date(feature.toggledAt).toLocaleString('pt-BR') : null
  return (
    <div
      className={
        'flex items-center justify-between gap-4 rounded-lg border p-4 ' +
        (feature.enabled ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white')
      }
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{feature.label}</span>
          {feature.core && (
            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-700">
              Core
            </span>
          )}
          <code className="text-xs text-gray-500">({feature.key})</code>
        </div>
        <p className="text-sm text-gray-600 mt-0.5">{feature.description}</p>
        {dt && (
          <p className="text-[11px] text-gray-500 mt-1">
            Última alteração: {dt}
            {feature.toggledBy ? ` por ${feature.toggledBy.slice(0, 8)}…` : ''}
          </p>
        )}
      </div>
      <button
        onClick={() => !feature.core && !busy && onToggle(!feature.enabled)}
        disabled={feature.core || busy}
        className={
          'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ' +
          (feature.core
            ? 'cursor-not-allowed bg-gray-100 text-gray-500'
            : feature.enabled
            ? 'bg-green-700 text-white hover:bg-green-800'
            : 'bg-gray-300 text-gray-700 hover:bg-gray-400')
        }
        style={{ minWidth: 96 }}
      >
        {feature.core ? (
          <>
            <Lock className="h-4 w-4" /> ON
          </>
        ) : busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : feature.enabled ? (
          <>
            <Power className="h-4 w-4" /> ON
          </>
        ) : (
          <>
            <PowerOff className="h-4 w-4" /> OFF
          </>
        )}
      </button>
    </div>
  )
}
