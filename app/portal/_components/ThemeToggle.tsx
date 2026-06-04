'use client'

import { useState, useTransition } from 'react'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle({ initial }: { initial: 'light' | 'dark' }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(initial)
  const [pending, startTransition] = useTransition()

  async function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    // Aplica imediatamente para evitar flash
    document.documentElement.classList.toggle('portal-dark', next === 'dark')
    setTheme(next)
    startTransition(async () => {
      try {
        await fetch('/api/portal/theme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: next }),
        })
      } catch {
        // se falhou, reverte
        document.documentElement.classList.toggle('portal-dark', theme === 'dark')
        setTheme(theme)
      }
    })
  }

  return (
    <button
      className="portal-theme-toggle"
      onClick={toggle}
      title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      disabled={pending}
    >
      {theme === 'dark' ? (
        <>
          <Sun size={14} /> Claro
        </>
      ) : (
        <>
          <Moon size={14} /> Escuro
        </>
      )}
    </button>
  )
}
