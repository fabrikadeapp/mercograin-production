'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  token: string
  email: string
  workspaceName: string
  cargo: string | null
  userJaExiste: boolean
}

export function AcceptInviteForm({
  token,
  email,
  workspaceName,
  cargo,
  userJaExiste,
}: Props) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const aceitarLogado = () => {
    setErr(null)
    startTransition(async () => {
      const res = await fetch('/api/workspace/members/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (j.error === 'precisa_login') {
          // Manda para login com next= de volta
          router.push(`/auth/login?email=${encodeURIComponent(email)}&next=/auth/aceitar-convite/${token}`)
          return
        }
        setErr(j.error || 'Não foi possível aceitar o convite.')
        return
      }
      router.push('/dashboard')
    })
  }

  const aceitarNovo = () => {
    setErr(null)
    if (nome.trim().length < 2) {
      setErr('Informe seu nome completo.')
      return
    }
    if (senha.length < 8) {
      setErr('Senha precisa de pelo menos 8 caracteres.')
      return
    }
    if (senha !== confirma) {
      setErr('As senhas não conferem.')
      return
    }
    startTransition(async () => {
      const res = await fetch('/api/workspace/members/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nome, senha }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(j.error || j.feedback?.[0] || 'Não foi possível criar sua conta.')
        return
      }
      router.push(
        `/auth/login?email=${encodeURIComponent(email)}&next=/dashboard&convite=aceito`,
      )
    })
  }

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-dim)',
          fontFamily: 'var(--f-mono)',
          marginBottom: 6,
        }}
      >
        Convite para
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{workspaceName}</h1>
      <p
        style={{
          marginTop: 8,
          fontSize: 13,
          color: 'var(--text-mute)',
        }}
      >
        Você foi convidado para acessar a licença <b>{workspaceName}</b> como{' '}
        <b>{email}</b>
        {cargo ? (
          <>
            {' '}— cargo <b>{cargo}</b>
          </>
        ) : (
          ''
        )}
        .
      </p>

      {userJaExiste ? (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13 }}>
            Você já tem conta no BH Grain com este email. Faça login para vincular
            o convite à sua conta.
          </p>
          <button
            type="button"
            onClick={aceitarLogado}
            disabled={pending}
            style={{
              marginTop: 16,
              width: '100%',
              padding: '12px 16px',
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              border: 0,
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {pending ? 'Aceitando…' : 'Aceitar convite'}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, marginBottom: 14 }}>
            Crie sua conta para acessar o workspace.
          </p>
          <Field label="Nome completo">
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Como você quer ser chamado"
              style={inputStyle}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              disabled
              style={{ ...inputStyle, opacity: 0.7 }}
            />
          </Field>
          <Field label="Senha (mín. 8 caracteres)">
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
              style={inputStyle}
            />
          </Field>
          <Field label="Confirmar senha">
            <input
              type="password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              autoComplete="new-password"
              style={inputStyle}
            />
          </Field>

          <button
            type="button"
            onClick={aceitarNovo}
            disabled={pending}
            style={{
              marginTop: 16,
              width: '100%',
              padding: '12px 16px',
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              border: 0,
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {pending ? 'Criando conta…' : 'Criar conta e aceitar'}
          </button>
        </div>
      )}

      {err && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: 'rgba(255,80,80,0.12)',
            border: '1px solid var(--danger, #ff5050)',
            color: 'var(--danger, #ff5050)',
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          {err}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          marginBottom: 4,
          fontFamily: 'var(--f-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
}
