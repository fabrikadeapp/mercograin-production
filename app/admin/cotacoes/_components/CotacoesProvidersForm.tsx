'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, Activity, Loader2 } from 'lucide-react'
import type { ProviderId, QuotesConfig } from '@/lib/quotes/types'

interface ProviderInfo {
  id: ProviderId
  displayName: string
  supports: string[]
  isConfigured: boolean
}

interface TestResult extends ProviderInfo {
  ok: boolean
  message?: string
  latencyMs?: number
}

interface Props {
  initialConfig: QuotesConfig
  providers: ProviderInfo[]
}

export function CotacoesProvidersForm({ initialConfig, providers }: Props) {
  const [primary, setPrimary] = useState<ProviderId>(initialConfig.primary)
  const [fallbacks, setFallbacks] = useState<ProviderId[]>(initialConfig.fallbacks)
  const [cacheMinutes, setCacheMinutes] = useState(initialConfig.cacheMinutes)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tests, setTests] = useState<TestResult[] | null>(null)

  const toggleFallback = (id: ProviderId) => {
    setFallbacks((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
    )
  }

  const moveFallback = (id: ProviderId, dir: -1 | 1) => {
    setFallbacks((curr) => {
      const idx = curr.indexOf(id)
      if (idx === -1) return curr
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= curr.length) return curr
      const next = [...curr]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      return next
    })
  }

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/cotacoes/providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary,
          fallbacks: fallbacks.filter((f) => f !== primary),
          cacheMinutes,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar.')
      setSuccess('Configuração salva. Próximas chamadas usam o provider escolhido.')
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado.')
    } finally {
      setBusy(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setError(null)
    setTests(null)
    try {
      const res = await fetch('/api/admin/cotacoes/providers/test', {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Falha no teste.')
      setTests(data.results as TestResult[])
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {error ? (
        <div className="flex items-start gap-2 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {success ? (
        <div className="flex items-start gap-2 p-3 rounded border border-emerald-200 bg-accent-soft text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-surface-1 p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Provider primário</h3>
          <div className="space-y-2">
            {providers.map((p) => (
              <label
                key={p.id}
                className={`flex items-start gap-3 p-3 rounded border cursor-pointer ${
                  primary === p.id
                    ? 'border-accent bg-accent-soft'
                    : 'border-border hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="primary"
                  value={p.id}
                  checked={primary === p.id}
                  onChange={() => setPrimary(p.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{p.displayName}</span>
                    {!p.isConfigured ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        sem chave
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Suporta: {p.supports.join(', ')}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Fallbacks (em ordem)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Se o provider primário falhar, o sistema tenta cada fallback na ordem listada.
          </p>
          <div className="space-y-2">
            {providers
              .filter((p) => p.id !== primary)
              .map((p) => {
                const idx = fallbacks.indexOf(p.id)
                const enabled = idx !== -1
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded border ${
                      enabled ? 'border-border bg-gray-50' : 'border-border'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleFallback(p.id)}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">
                        {p.displayName}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({p.supports.join(', ')})
                      </span>
                    </div>
                    {enabled ? (
                      <>
                        <span className="text-xs font-mono text-gray-500">#{idx + 1}</span>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveFallback(p.id, -1)}
                          className="px-2 py-0.5 text-xs rounded border border-border hover:bg-gray-100 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === fallbacks.length - 1}
                          onClick={() => moveFallback(p.id, 1)}
                          className="px-2 py-0.5 text-xs rounded border border-border hover:bg-gray-100 disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </>
                    ) : null}
                  </div>
                )
              })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Cache (minutos)
          </label>
          <input
            type="number"
            min={0}
            max={60}
            value={cacheMinutes}
            onChange={(e) => setCacheMinutes(Math.max(0, Number(e.target.value) || 0))}
            className="w-32 px-3 py-2 rounded border border-border text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Tempo em memória que o resultado é reaproveitado entre requests. 0 = sem cache.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-accent text-accent-ink text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Salvando…' : 'Salvar configuração'}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-border text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Activity className="w-4 h-4" />
            )}
            Testar todas as fontes
          </button>
        </div>
      </section>

      {tests ? (
        <section className="rounded-lg border border-border bg-surface-1 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Resultado do teste</h3>
          <div className="divide-y divide-gray-100">
            {tests.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5">
                {t.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{t.displayName}</div>
                  {t.message ? (
                    <div className="text-xs text-red-600">{t.message}</div>
                  ) : null}
                </div>
                {t.ok && typeof t.latencyMs === 'number' ? (
                  <span className="text-xs font-mono text-gray-500">{t.latencyMs}ms</span>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
