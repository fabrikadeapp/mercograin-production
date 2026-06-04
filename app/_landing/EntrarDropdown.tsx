'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Building2, Sprout, ChevronDown } from 'lucide-react'

/**
 * Botão "Entrar ▾" no header da landing.
 * Submenu com 2 opções: Sou corretor → /auth/login, Sou produtor → /portal.
 */
export function EntrarDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return
      if (ref.current.contains(e.target as Node)) return
      setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md bg-transparent px-3 py-1.5 text-small text-fg-1 hover:bg-bg-2"
      >
        Entrar <ChevronDown size={14} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-[280px] overflow-hidden rounded-xl border border-line-1 bg-bg-0 shadow-lg"
        >
          <Link
            href="/auth/login"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-bg-2"
          >
            <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-md bg-accent text-bg-0">
              <Building2 size={16} />
            </div>
            <div>
              <div className="text-small font-medium text-fg-1">Sou corretor</div>
              <div className="text-mini text-fg-2">
                Acesse o painel da sua corretora
              </div>
            </div>
          </Link>
          <Link
            href="/portal"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 border-t border-line-1 px-3 py-2.5 transition-colors hover:bg-bg-2"
          >
            <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-md bg-accent text-bg-0">
              <Sprout size={16} />
            </div>
            <div>
              <div className="text-small font-medium text-fg-1">
                Sou produtor ou cooperativa
              </div>
              <div className="text-mini text-fg-2">
                Veja contratos da sua corretora
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}
