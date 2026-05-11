'use client'

import { Suspense, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

function SetupForm() {
  const params = useParams<{ workspaceSlug: string }>()
  const sp = useSearchParams()
  const router = useRouter()
  const [token, setToken] = useState(sp.get('token') ?? '')
  const [email, setEmail] = useState(sp.get('email') ?? '')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha !== senha2) {
      setErro('Senhas não conferem')
      return
    }
    setLoading(true)
    try {
      const r = await fetch('/api/portal/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, novaSenha: senha }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setErro(j.error ?? 'Erro')
        return
      }
      router.push(`/portal/${params.workspaceSlug}`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
      <h1 className="text-xl font-semibold">Criar sua senha</h1>
      <p className="text-sm text-gray-500">Use o link enviado por email para definir sua senha do portal.</p>
      {erro && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{erro}</div>}
      <div>
        <label className="block text-sm">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm">Token (do email)</label>
        <input type="text" required value={token} onChange={(e) => setToken(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 font-mono text-xs" />
      </div>
      <div>
        <label className="block text-sm">Nova senha</label>
        <input type="password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
        <p className="mt-1 text-xs text-gray-500">Mín. 8 caracteres com maiúscula, minúscula e número.</p>
      </div>
      <div>
        <label className="block text-sm">Confirmar senha</label>
        <input type="password" required value={senha2} onChange={(e) => setSenha2(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <button disabled={loading} className="w-full rounded bg-green-700 py-2 text-white disabled:opacity-50">
        {loading ? 'Criando…' : 'Criar senha e entrar'}
      </button>
    </form>
  )
}

export default function PortalSetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Suspense fallback={<div>Carregando…</div>}>
        <SetupForm />
      </Suspense>
    </div>
  )
}
