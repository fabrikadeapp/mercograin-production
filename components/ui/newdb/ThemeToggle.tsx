'use client'

import { useEffect, useState } from 'react'

/**
 * ThemeToggle — dois botões (sol/lua) conforme design2/BH Grain - Design v2.html.
 * Persiste em localStorage["bhg-theme"]. O script anti-FOUC no <head> já
 * aplicou o data-theme antes do hydrate; aqui só sincronizamos o estado.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const stored = (typeof window !== 'undefined' && localStorage.getItem('bhg-theme')) || 'dark'
    setTheme(stored === 'light' ? 'light' : 'dark')
  }, [])

  const apply = (next: 'dark' | 'light') => {
    setTheme(next)
    const root = document.documentElement
    if (next === 'light') root.setAttribute('data-theme', 'light')
    else root.setAttribute('data-theme', 'phb')
    try {
      localStorage.setItem('bhg-theme', next)
    } catch {}
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Tema">
      <button
        type="button"
        data-theme-set="dark"
        aria-label="Tema escuro"
        title="Escuro"
        className={theme === 'dark' ? 'active' : ''}
        onClick={() => apply('dark')}
      >
        <svg viewBox="0 0 24 24">
          <path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z" />
        </svg>
      </button>
      <button
        type="button"
        data-theme-set="light"
        aria-label="Tema claro"
        title="Claro"
        className={theme === 'light' ? 'active' : ''}
        onClick={() => apply('light')}
      >
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </button>
    </div>
  )
}
