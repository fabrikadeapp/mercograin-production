'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Building2 } from 'lucide-react'

interface AcessoCard {
  accessId: string
  slug: string
  nomeCorretora: string
  logoUrl: string | null
}

export function PortalEntradaView() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [acessos, setAcessos] = useState<AcessoCard[] | null>(null)

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErro(null)
    try {
      const r = await fetch('/api/portal/auth/login-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(j.error === 'credenciais_invalidas' ? 'Email ou senha incorretos.' : 'Erro ao entrar.')
        return
      }
      if (j.modo === 'single') {
        router.push(`/portal/${j.slug}`)
        router.refresh()
        return
      }
      setAcessos(j.acessos ?? [])
    } finally {
      setBusy(false)
    }
  }

  async function escolherCorretora(accessId: string) {
    setBusy(true)
    setErro(null)
    try {
      const r = await fetch('/api/portal/auth/login-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha, accessId }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro(j.error === 'credenciais_invalidas' ? 'Sessão expirou — faça login novamente.' : 'Erro.')
        setAcessos(null)
        return
      }
      router.push(`/portal/${j.slug}`)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  // ---------- Render: tela 2 (escolher corretora) ----------
  if (acessos && acessos.length > 1) {
    return (
      <div style={card}>
        <h1 style={title}>Suas corretoras</h1>
        <p style={muted}>
          Encontramos sua conta em <strong>{acessos.length}</strong> corretoras. Escolha qual deseja acessar agora.
        </p>
        <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
          {acessos.map((a) => (
            <button
              key={a.accessId}
              onClick={() => escolherCorretora(a.accessId)}
              disabled={busy}
              style={cardBtn}
            >
              <div style={logoBox}>
                {a.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.logoUrl} alt={a.nomeCorretora} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <Building2 size={20} />
                )}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.nomeCorretora}</div>
                <div style={{ fontSize: 12, color: 'var(--portal-ink-mute)' }}>{a.slug}</div>
              </div>
              <span style={{ color: 'var(--portal-accent)', fontSize: 18 }}>→</span>
            </button>
          ))}
        </div>
        <button onClick={() => { setAcessos(null); setSenha('') }} style={linkBtn}>
          Trocar de email/senha
        </button>
      </div>
    )
  }

  // ---------- Render: tela 1 (login) ----------
  return (
    <div style={card}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--portal-accent)' }}>BH Grain · Portal</div>
        <div style={muted}>Para produtores e cooperativas</div>
      </div>
      <form onSubmit={submitLogin}>
        <label style={lblStyle}>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={input} />
        </label>
        <label style={lblStyle}>
          <span>Senha</span>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required style={input} />
        </label>
        <button type="submit" disabled={busy || !email || senha.length < 1} style={btn}>
          {busy ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} /> : null}
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      {erro && <div style={errBox}>{erro}</div>}
      <p style={{ fontSize: 12, color: 'var(--portal-ink-mute)', marginTop: 14, textAlign: 'center' }}>
        Recebeu um link da sua corretora?{' '}
        <span style={{ color: 'var(--portal-accent)' }}>Use o link direto do email/WhatsApp</span>{' '}
        para acessar o contrato.
      </p>
      <p style={{ fontSize: 11, color: 'var(--portal-ink-mute)', marginTop: 24, textAlign: 'center' }}>
        powered by <strong>BH Grain</strong>
      </p>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const card: React.CSSProperties = {
  background: 'var(--portal-surface)',
  border: '1px solid var(--portal-border)',
  borderRadius: 14,
  padding: 26,
  width: '100%',
  maxWidth: 420,
  boxShadow: 'var(--portal-shadow)',
  color: 'var(--portal-ink)',
}
const title: React.CSSProperties = { fontSize: 18, margin: 0, fontWeight: 600 }
const muted: React.CSSProperties = { color: 'var(--portal-ink-mute)', fontSize: 13, margin: '4px 0 0' }
const lblStyle: React.CSSProperties = { display: 'block', marginBottom: 12, fontSize: 12, color: 'var(--portal-ink-dim)' }
const input: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--portal-border)',
  background: 'var(--portal-surface)', color: 'var(--portal-ink)', fontSize: 14, marginTop: 4,
}
const btn: React.CSSProperties = {
  width: '100%', background: 'var(--portal-accent)', color: '#fff',
  padding: 12, border: 0, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
}
const cardBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: 12,
  background: 'var(--portal-surface-2)', border: '1px solid var(--portal-border)',
  borderRadius: 12, cursor: 'pointer', color: 'var(--portal-ink)',
}
const logoBox: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 8, background: 'var(--portal-surface)',
  border: '1px solid var(--portal-border)', display: 'grid', placeItems: 'center', overflow: 'hidden',
  color: 'var(--portal-ink-mute)',
}
const linkBtn: React.CSSProperties = {
  display: 'block', textAlign: 'center', marginTop: 14, color: 'var(--portal-accent)',
  background: 'transparent', border: 0, cursor: 'pointer', fontSize: 12, textDecoration: 'underline', width: '100%',
}
const errBox: React.CSSProperties = {
  background: 'var(--portal-danger-soft)', color: 'var(--portal-danger)', padding: 10,
  borderRadius: 8, marginTop: 12, fontSize: 13,
}
