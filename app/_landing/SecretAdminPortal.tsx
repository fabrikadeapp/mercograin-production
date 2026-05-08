'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Brand, Button, Input } from '@/components/ui/phb'
import { Lock, ShieldAlert, Mail, X } from 'lucide-react'

const REQUIRED_CLICKS = 5
const WINDOW_MS = 3000  // 5 cliques em até 3 segundos

/**
 * Wrapper client em volta do Brand. Detecta 5 cliques rápidos e abre portal
 * secreto pra superadmin. Sem indicação visual prévia — é easter egg.
 */
export function SecretAdminPortal() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const clickTimes = React.useRef<number[]>([])

  function handleBrandClick() {
    const now = Date.now()
    // Mantém só os clicks dentro da janela
    clickTimes.current = clickTimes.current.filter((t) => now - t < WINDOW_MS)
    clickTimes.current.push(now)

    if (clickTimes.current.length >= REQUIRED_CLICKS) {
      clickTimes.current = []
      setOpen(true)
      // Pequeno haptic visual
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { (navigator as any).vibrate?.([12, 8, 12]) } catch {}
      }
    }
  }

  // Esc fecha
  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Bloqueia scroll quando aberto
  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (res?.error) {
        setError('Credenciais inválidas')
        setLoading(false)
        return
      }
      // Login OK — vai direto pro /admin (se for admin) ou /dashboard
      router.push('/admin')
      router.refresh()
    } catch {
      setError('Falha ao acessar')
      setLoading(false)
    }
  }

  // Render do modal — em <body> via portal pra escapar de sticky/overflow contexts
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])

  const modal = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="secret-admin-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-bg-0/85 backdrop-blur-md"
        onClick={() => setOpen(false)}
      />

      {/* Painel — centrado no viewport */}
      <div className="relative z-10 w-full max-w-md my-auto rounded-lg border border-border-2 bg-bg-1 shadow-pop">
            <div className="flex items-start justify-between gap-4 border-b border-border-1 px-6 py-5">
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-pill border border-border-2"
                  style={{ background: 'color-mix(in srgb, var(--neg) 12%, transparent)' }}
                >
                  <ShieldAlert className="h-5 w-5" style={{ color: 'var(--neg)' }} />
                </div>
                <div>
                  <p className="eyebrow" style={{ color: 'var(--neg)' }}>ACESSO RESTRITO</p>
                  <h2 id="secret-admin-title" className="text-h3 text-fg-1">
                    Portal SuperAdmin
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="text-fg-3 transition-colors hover:text-fg-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <Input
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="superadmin@profitsync.ia.br"
                leftIcon={<Mail className="h-4 w-4 text-fg-3" />}
                autoFocus
                required
                autoComplete="email"
              />
              <Input
                label="Senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                leftIcon={<Lock className="h-4 w-4 text-fg-3" />}
                required
                autoComplete="current-password"
              />

              {error ? (
                <p className="text-small" style={{ color: 'var(--neg)' }}>
                  {error}
                </p>
              ) : null}

              <Button type="submit" fullWidth loading={loading}>
                Acessar painel
              </Button>

              <p className="text-center text-micro text-fg-4">
                Esta área é destinada a administradores autorizados.
              </p>
            </form>
          </div>
        </div>
  ) : null

  return (
    <>
      {/* Brand clicável (sem dica visual) */}
      <button
        type="button"
        onClick={handleBrandClick}
        aria-label="PHB Grain — Início"
        className="cursor-pointer focus:outline-none"
      >
        <Brand />
      </button>

      {/* Renderiza modal no <body> via portal — escapa de sticky/overflow do nav */}
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  )
}
