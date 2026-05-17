'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'

interface Props {
  initial: string | null
  nome: string
}

export function CodigoWorkspaceCard({ initial, nome }: Props) {
  const sugerido = (nome || 'WKS')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase()
  const [codigo, setCodigo] = useState(initial ?? sugerido)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = () => {
    setErr(null)
    setSaved(false)
    const valor = codigo.trim().toUpperCase()
    if (valor.length < 2 || valor.length > 8 || !/^[A-Z0-9]+$/.test(valor)) {
      setErr('Use 2-8 caracteres (letras maiúsculas e números)')
      return
    }
    startTransition(async () => {
      const res = await fetch('/api/workspace/codigo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: valor }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErr(j.error || 'Erro ao salvar')
        return
      }
      setCodigo(valor)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <div
      style={{
        padding: 20,
        border: '1px solid var(--border-1, rgba(255,255,255,0.08))',
        borderRadius: 12,
        background: 'var(--bg-2, rgba(255,255,255,0.02))',
        marginBottom: 20,
        maxWidth: 600,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--fg-3, var(--text-dim))',
          fontFamily: 'var(--f-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
        }}
      >
        Código do workspace
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Prefixo da numeração de propostas e contratos
      </div>
      <p
        style={{
          fontSize: 12,
          color: 'var(--fg-2, var(--text-mute))',
          marginBottom: 14,
        }}
      >
        Aparece como prefixo nos números (ex.: <code>{codigo}2026051701P</code> para uma
        proposta). 2 a 8 caracteres, apenas letras maiúsculas e números.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={codigo}
          onChange={(e) =>
            setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
          }
          maxLength={8}
          placeholder={sugerido}
          style={{
            padding: '8px 12px',
            fontSize: 14,
            fontFamily: 'var(--f-mono)',
            background: 'var(--bg-1, var(--surface-2))',
            border: '1px solid var(--border-1, var(--border))',
            borderRadius: 8,
            color: 'var(--text)',
            outline: 'none',
            width: 140,
            textTransform: 'uppercase',
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          style={{
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            border: 0,
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          {pending ? 'Salvando…' : saved ? '✓ Salvo' : 'Salvar código'}
        </button>
        {saved && <Check className="w-4 h-4" style={{ color: 'var(--success)' }} />}
      </div>
      {err && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--danger, #ff5050)',
          }}
        >
          {err}
        </div>
      )}
    </div>
  )
}
