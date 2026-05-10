'use client'

import { useEffect, useState } from 'react'

type State = 'loading' | 'disabled' | 'setup' | 'enabled'

export default function TwoFactorPage() {
  const [state, setState] = useState<State>('loading')
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string>('')
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState('')

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        setState(u?.totpEnabled ? 'enabled' : 'disabled')
      })
      .catch(() => setState('disabled'))
  }, [])

  async function startSetup() {
    setBusy(true)
    setError('')
    const r = await fetch('/api/auth/2fa/setup')
    const data = await r.json()
    if (!r.ok) {
      setError(data.error || 'Erro')
      setBusy(false)
      return
    }
    setSecret(data.secret)
    setQr(data.qrCodeBase64)
    setState('setup')
    setBusy(false)
  }

  async function confirmSetup() {
    setBusy(true)
    setError('')
    const r = await fetch('/api/auth/2fa/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, code }),
    })
    const data = await r.json()
    if (!r.ok) {
      setError(data.error || 'Código inválido')
      setBusy(false)
      return
    }
    setRecoveryCodes(data.recoveryCodes)
    setState('enabled')
    setBusy(false)
  }

  async function disable2FA() {
    setBusy(true)
    setError('')
    const r = await fetch('/api/auth/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, code }),
    })
    const data = await r.json()
    if (!r.ok) {
      setError(data.error || 'Erro')
      setBusy(false)
      return
    }
    setState('disabled')
    setRecoveryCodes(null)
    setBusy(false)
  }

  async function regenerateCodes() {
    setBusy(true)
    setError('')
    const r = await fetch('/api/auth/2fa/recovery-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, code }),
    })
    const data = await r.json()
    if (!r.ok) {
      setError(data.error || 'Erro')
      setBusy(false)
      return
    }
    setRecoveryCodes(data.recoveryCodes)
    setBusy(false)
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Autenticação em 2 Fatores (2FA)</h1>

      {error && (
        <div className="p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {state === 'loading' && <p>Carregando…</p>}

      {state === 'disabled' && (
        <div className="space-y-4">
          <p className="text-gray-700">
            Adicione uma camada extra de segurança usando um app como Google
            Authenticator, Authy ou Microsoft Authenticator.
          </p>
          <button
            onClick={startSetup}
            disabled={busy}
            className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
          >
            Habilitar 2FA
          </button>
        </div>
      )}

      {state === 'setup' && (
        <div className="space-y-4">
          <p>1) Escaneie este QR no seu app autenticador:</p>
          {qr && <img src={qr} alt="QR Code" className="border rounded" />}
          <p className="text-xs text-gray-500 break-all">
            Ou cole manualmente: <code>{secret}</code>
          </p>
          <p>2) Digite o código de 6 dígitos gerado:</p>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            className="border rounded px-3 py-2 text-2xl tracking-widest text-center w-48"
            inputMode="numeric"
          />
          <div>
            <button
              onClick={confirmSetup}
              disabled={busy || code.length !== 6}
              className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {state === 'enabled' && (
        <div className="space-y-4">
          <div className="p-3 rounded bg-emerald-50 text-emerald-800">
            ✓ 2FA está ativo nesta conta.
          </div>

          {recoveryCodes && (
            <div className="p-4 rounded border border-amber-300 bg-amber-50">
              <p className="font-semibold mb-2">
                Códigos de recuperação (mostrados apenas 1 vez):
              </p>
              <pre className="font-mono text-sm bg-white p-3 rounded border">
                {recoveryCodes.join('\n')}
              </pre>
              <p className="text-xs text-amber-700 mt-2">
                Salve estes códigos em local seguro. Cada um pode ser usado uma
                única vez para entrar caso você perca acesso ao seu autenticador.
              </p>
            </div>
          )}

          <div className="space-y-2 border-t pt-4">
            <h2 className="font-semibold">Operações sensíveis</h2>
            <input
              type="password"
              placeholder="Senha atual"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
            <input
              type="text"
              placeholder="Código TOTP atual (6 dígitos)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              className="border rounded px-3 py-2 w-full"
            />
            <div className="flex gap-2">
              <button
                onClick={regenerateCodes}
                disabled={busy}
                className="px-4 py-2 rounded border disabled:opacity-50"
              >
                Regenerar códigos de recuperação
              </button>
              <button
                onClick={disable2FA}
                disabled={busy}
                className="px-4 py-2 rounded border border-red-300 text-red-700 disabled:opacity-50"
              >
                Desabilitar 2FA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
