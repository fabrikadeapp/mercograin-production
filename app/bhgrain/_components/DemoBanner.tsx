'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import Link from 'next/link'

export function DemoBanner() {
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/bhgrain/demo-status')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        setEnabled(!!j.enabled)
      })
      .catch(() => setEnabled(false))
    return () => {
      cancelled = true
    }
  }, [])

  if (!enabled) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 text-center py-1.5 text-[12px] font-semibold backdrop-blur-md"
      style={{
        background: 'linear-gradient(90deg, rgba(245,158,11,0.85), rgba(234,88,12,0.85))',
        color: '#fff',
      }}
    >
      <Sparkles className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
      Modo demonstração — dados fictícios. Nenhuma integração externa real está ativa.
      <Link href="/admin/bhgrain/demo" className="ml-2 underline opacity-90 hover:opacity-100">
        Gerenciar
      </Link>
    </div>
  )
}
