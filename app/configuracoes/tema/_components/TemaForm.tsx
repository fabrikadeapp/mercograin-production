'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Lock } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import {
  DESIGN_SYSTEMS,
  type DesignSystemSlug,
} from '@/lib/ui/design-systems'

export function TemaForm({
  current,
  canEdit,
}: {
  current: DesignSystemSlug
  canEdit: boolean
}) {
  const [selected, setSelected] = useState<DesignSystemSlug>(current)
  const [saving, startSaving] = useTransition()
  const toast = useToast()
  const router = useRouter()

  const dirty = selected !== current

  function save() {
    if (!dirty || !canEdit) return
    startSaving(async () => {
      try {
        const res = await fetch('/api/workspace/tema', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ designSystem: selected }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Falha ao salvar')
        }
        toast.success('Tema atualizado. Aplicando…')
        // Recarrega para o SSR reaplicar o data-theme no <html>.
        router.refresh()
        // Pequeno delay para o toast aparecer antes do reload visual.
        setTimeout(() => window.location.reload(), 600)
      } catch (e: any) {
        toast.error(e?.message || 'Não foi possível salvar o tema')
      }
    })
  }

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--text-mute)]">
          <Lock size={15} />
          Apenas o proprietário ou administrador da corretora pode alterar o
          tema.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {DESIGN_SYSTEMS.map((ds) => {
          const isSel = selected === ds.slug
          const isCurrent = current === ds.slug
          const [bg, surface, accent, accent2, signal] = ds.swatches
          return (
            <button
              key={ds.slug}
              type="button"
              disabled={!canEdit}
              onClick={() => canEdit && setSelected(ds.slug)}
              className={[
                'group relative overflow-hidden rounded-[var(--r-lg)] border text-left transition-all',
                isSel
                  ? 'border-[var(--accent)] ring-2 ring-[color-mix(in_srgb,var(--accent)_40%,transparent)]'
                  : 'border-[var(--border)] hover:border-[var(--border-strong)]',
                canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-80',
              ].join(' ')}
            >
              {/* Mini-preview com as cores reais do tema */}
              <div
                className="relative h-32 w-full"
                style={{ background: bg }}
              >
                {/* topbar fake */}
                <div
                  className="flex items-center gap-2 px-3"
                  style={{
                    height: 26,
                    borderBottom: `1px solid color-mix(in srgb, ${surface} 60%, transparent)`,
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 4,
                      background: accent,
                    }}
                  />
                  <span
                    style={{
                      width: 46,
                      height: 5,
                      borderRadius: 3,
                      background: `color-mix(in srgb, ${signal} 60%, transparent)`,
                    }}
                  />
                </div>
                {/* corpo: 2 mini-cards */}
                <div className="flex gap-2 p-3">
                  <div
                    className="flex-1 rounded-md p-2"
                    style={{
                      background: surface,
                      border: `1px solid color-mix(in srgb, ${signal} 22%, transparent)`,
                    }}
                  >
                    <div
                      style={{
                        width: '60%',
                        height: 4,
                        borderRadius: 2,
                        background: accent,
                        marginBottom: 6,
                      }}
                    />
                    <div
                      style={{
                        width: '85%',
                        height: 4,
                        borderRadius: 2,
                        background: `color-mix(in srgb, ${signal} 45%, transparent)`,
                      }}
                    />
                  </div>
                  <div
                    className="w-12 rounded-md p-2"
                    style={{
                      background: accent,
                    }}
                  >
                    <div
                      style={{
                        width: '70%',
                        height: 4,
                        borderRadius: 2,
                        background: bg,
                      }}
                    />
                  </div>
                </div>
                {/* swatches dos signals */}
                <div className="absolute bottom-2 left-3 flex gap-1.5">
                  {[accent2, signal].map((c, i) => (
                    <span
                      key={i}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: c,
                      }}
                    />
                  ))}
                </div>
                {isSel && (
                  <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]">
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </div>

              {/* meta */}
              <div className="bg-[var(--surface-1)] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[var(--text)]">
                    {ds.name}
                  </span>
                  {isCurrent && (
                    <span className="rounded-full bg-[var(--success-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--success)]">
                      Atual
                    </span>
                  )}
                  <span className="ml-auto text-[10px] uppercase text-[var(--text-dim)]">
                    {ds.mode === 'dark' ? 'Escuro' : 'Claro'}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] leading-snug text-[var(--text-mute)]">
                  {ds.tagline}
                </p>
                <p className="mt-1 font-mono text-[10px] text-[var(--text-dim)]">
                  {ds.fonts}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)] transition-opacity disabled:opacity-40"
          >
            {saving ? 'Aplicando…' : 'Aplicar tema'}
          </button>
          {dirty && !saving && (
            <button
              type="button"
              onClick={() => setSelected(current)}
              className="text-sm font-medium text-[var(--text-mute)] hover:text-[var(--text)]"
            >
              Cancelar
            </button>
          )}
          {!dirty && (
            <span className="text-sm text-[var(--text-dim)]">
              Este é o tema atual da corretora.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
