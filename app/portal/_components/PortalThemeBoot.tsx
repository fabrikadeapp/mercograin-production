/**
 * Aplica/remove a classe portal-dark no <html> baseado no cookie.
 * Como o html vem do root layout sem essa classe, este componente sincroniza
 * no client side antes do paint (effect síncrono).
 */
'use client'

import { useEffect } from 'react'

export function PortalThemeBoot({ theme }: { theme: 'light' | 'dark' }) {
  useEffect(() => {
    document.documentElement.classList.toggle('portal-dark', theme === 'dark')
    return () => {
      document.documentElement.classList.remove('portal-dark')
    }
  }, [theme])
  return null
}
