'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Atalhos de teclado globais (Gmail style):
 *  g d → dashboard
 *  g c → clientes
 *  g p → propostas
 *  g f → financeiro
 *  g l → Laura.IA
 *  g e → equipe
 *  n p → nova proposta
 *  ?   → ajuda (modal)
 *
 * Ignora se foco está em input/textarea.
 */

const SHORTCUTS: Record<string, string> = {
  'g d': '/dashboard',
  'g c': '/clientes',
  'g p': '/propostas',
  'g a': '/aprovacoes/propostas',
  'g f': '/financeiro',
  'g k': '/financeiro/comissoes',
  'g l': '/laura',
  'g e': '/gestao/equipe',
  'g s': '/configuracoes',
  'n p': '/propostas/nova',
  'n c': '/clientes/novo',
}

export function KeyboardShortcuts() {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    let resetTimer: ReturnType<typeof setTimeout> | null = null

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        target?.isContentEditable
      ) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === '?') {
        e.preventDefault()
        setHelpOpen((v) => !v)
        return
      }
      if (e.key === 'Escape') {
        setHelpOpen(false)
        setPending(null)
        return
      }

      const key = e.key.toLowerCase()
      if (!/^[a-z]$/.test(key)) return

      const combo = pending ? `${pending} ${key}` : key
      const dest = SHORTCUTS[combo]
      if (dest) {
        e.preventDefault()
        setPending(null)
        router.push(dest)
        return
      }

      // Inicia uma sequência se o atual é primeiro caractere de algum atalho
      const isPrefix = Object.keys(SHORTCUTS).some((s) => s.startsWith(`${key} `))
      if (isPrefix) {
        e.preventDefault()
        setPending(key)
        if (resetTimer) clearTimeout(resetTimer)
        resetTimer = setTimeout(() => setPending(null), 1500)
      } else {
        setPending(null)
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (resetTimer) clearTimeout(resetTimer)
    }
  }, [router, pending])

  return (
    <>
      {pending && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface-1, rgba(0,0,0,0.85))',
            border: '1px solid var(--border)',
            borderRadius: 999,
            padding: '6px 14px',
            fontFamily: 'var(--f-mono)',
            fontSize: 12,
            color: 'var(--text)',
            zIndex: 100,
          }}
        >
          {pending} <span style={{ opacity: 0.5 }}>…</span>
        </div>
      )}
      {helpOpen && <ShortcutsHelpModal onClose={() => setHelpOpen(false)} />}
    </>
  )
}

function ShortcutsHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--f-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-dim)',
            marginBottom: 6,
          }}
        >
          ATALHOS DE TECLADO
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, marginBottom: 16 }}>
          Navegação rápida
        </h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {Object.entries(SHORTCUTS).map(([combo, dest]) => (
            <div
              key={combo}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--text-mute)' }}>{dest}</span>
              <Kbd combo={combo} />
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 0',
              marginTop: 8,
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--text-mute)' }}>Esta ajuda</span>
            <Kbd combo="?" />
          </div>
        </div>
        <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-dim)' }}>
          Pressione Esc para fechar.
        </p>
      </div>
    </div>
  )
}

function Kbd({ combo }: { combo: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {combo.split(' ').map((k, i) => (
        <kbd
          key={i}
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '2px 6px',
            fontSize: 11,
            fontFamily: 'var(--f-mono)',
            color: 'var(--text)',
          }}
        >
          {k}
        </kbd>
      ))}
    </span>
  )
}
