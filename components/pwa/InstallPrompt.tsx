/**
 * Banner discreto de "Instalar app" pra PWA.
 *
 * - Escuta beforeinstallprompt do browser
 * - Lembra dispensa do usuário em localStorage (24h)
 * - Some automaticamente quando o app já está instalado (display-mode standalone)
 *
 * Plug-and-play: importar em algum layout (ex.: dashboard) e renderizar.
 */
'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'bh-grain.install-prompt.dismissedAt'
const DISMISS_MS = 24 * 3600 * 1000

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Já instalado?
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (isStandalone) return

    // Dispensado recentemente?
    try {
      const v = localStorage.getItem(DISMISS_KEY)
      if (v && Date.now() - parseInt(v, 10) < DISMISS_MS) return
    } catch {}

    const onBefore = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBefore)
    return () => window.removeEventListener('beforeinstallprompt', onBefore)
  }, [])

  async function instalar() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setVisible(false)
    setDeferred(null)
  }

  function dispensar() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] rounded-lg border border-bg-3 bg-bg-1 px-4 py-3 shadow-xl">
      <p className="text-sm font-medium text-fg-1">Instalar BH Grain</p>
      <p className="text-xs text-fg-3 mt-1">
        Funciona offline, abre direto na balança e recebe notificações.
      </p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={dispensar}
          className="rounded-md px-2 py-1 text-xs text-fg-3 hover:text-fg-1"
        >
          Agora não
        </button>
        <button
          onClick={instalar}
          className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white"
        >
          Instalar
        </button>
      </div>
    </div>
  )
}
