'use client'
/**
 * S10 M2 — Atalhos de teclado da Mesa profissional.
 *  Ctrl+B  → /ofertas/nova?tipo=compra
 *  Ctrl+S  → /ofertas/nova?tipo=venda
 *  Ctrl+K  → /calculadora
 *  Ctrl+/  → toggle do modal de ajuda
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Keyboard, X } from 'lucide-react'
import { useKeyboardShortcuts, type Shortcut } from '@/lib/ui/useKeyboardShortcuts'

interface Props { sseTransport?: 'sse' | 'polling' | null }

const SHORTCUT_DEFS = [
  { combo: 'Ctrl/Cmd + B', label: 'Nova oferta de COMPRA' },
  { combo: 'Ctrl/Cmd + S', label: 'Nova oferta de VENDA' },
  { combo: 'Ctrl/Cmd + K', label: 'Abrir Calculadora' },
  { combo: 'Ctrl/Cmd + /', label: 'Mostrar/ocultar atalhos' },
]

export function AtalhosTecladoHelper({ sseTransport }: Props) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  const shortcuts: Shortcut[] = React.useMemo(() => [
    { key: 'b', ctrl: true, description: 'Nova oferta compra',
      handler: () => router.push('/ofertas/nova?tipo=compra') },
    { key: 's', ctrl: true, description: 'Nova oferta venda',
      handler: () => router.push('/ofertas/nova?tipo=venda') },
    { key: 'k', ctrl: true, description: 'Calculadora',
      handler: () => router.push('/calculadora') },
    { key: '/', ctrl: true, description: 'Toggle ajuda atalhos',
      handler: () => setOpen((v) => !v) },
    { key: 'Escape', description: 'Fechar ajuda', ignoreInInputs: false,
      handler: () => setOpen(false) },
  ], [router])

  useKeyboardShortcuts(shortcuts)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white/80 backdrop-blur hover:bg-black/80"
        title="Atalhos de teclado (Ctrl+/)"
      >
        <Keyboard className="h-3.5 w-3.5" />
        Atalhos
        {sseTransport && (
          <span className={`ml-2 inline-block h-1.5 w-1.5 rounded-full ${sseTransport === 'sse' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Atalhos da Mesa</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 hover:bg-white/10"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {SHORTCUT_DEFS.map((s) => (
                <li key={s.combo} className="flex items-center justify-between rounded border border-white/5 px-3 py-2">
                  <span className="text-zinc-300">{s.label}</span>
                  <kbd className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs">{s.combo}</kbd>
                </li>
              ))}
            </ul>
            {sseTransport && (
              <p className="mt-4 text-xs text-zinc-400">
                Transporte de cotações: <strong className={sseTransport === 'sse' ? 'text-emerald-400' : 'text-amber-400'}>
                  {sseTransport === 'sse' ? 'SSE (realtime 5s)' : 'Polling (20s)'}
                </strong>
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
