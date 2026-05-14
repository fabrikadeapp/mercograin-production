'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { UiTheme } from '@/lib/ui/theme'

interface ThemeOption {
  id: UiTheme
  label: string
  description: string
}

interface Props {
  initialTheme: UiTheme
  options: ThemeOption[]
}

export function DesignThemeForm({ initialTheme, options }: Props) {
  const router = useRouter()
  const [theme, setTheme] = useState<UiTheme>(initialTheme)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/design', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar.')
      setSuccess(
        'Tema salvo. Próximos page-loads usam o tema escolhido (cache de config é de ~30s).',
      )
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'erro')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
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

      <section className="rounded-lg border border-border bg-surface-1 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Tema global</h3>
        <div className="space-y-2">
          {options.map((opt) => (
            <label
              key={opt.id}
              className={`flex items-start gap-3 p-3 rounded border cursor-pointer ${
                theme === opt.id
                  ? 'border-accent bg-accent-soft'
                  : 'border-border hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={opt.id}
                checked={theme === opt.id}
                onChange={() => setTheme(opt.id)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || theme === initialTheme}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-accent text-accent-ink text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Salvando…' : 'Salvar tema'}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface-1 p-4 text-sm text-text-mute">
        <p className="font-medium mb-1 text-text">Tema único — NewDB v2</p>
        <p className="text-xs leading-relaxed">
          O produto opera com um único tema global (NewDB v2: lime accent sobre dark, tipografia
          Inter/JetBrains Mono/Instrument Serif). Light theme e variantes futuras serão expostas
          aqui.
        </p>
      </section>
    </div>
  )
}
