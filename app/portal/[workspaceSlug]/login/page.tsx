'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function PortalLoginPage() {
  const params = useParams<{ workspaceSlug: string }>()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    try {
      const r = await fetch('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setErro(j.error ?? 'Erro ao entrar')
        return
      }
      router.push(`/portal/${params.workspaceSlug}`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold">Portal do Produtor</h1>
        <p className="text-sm text-gray-500">Acesso ao seu painel na corretora.</p>
        {erro && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{erro}</div>}
        <div>
          <label className="block text-sm">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm">Senha</label>
          <input
            type="password"
            required
            minLength={8}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <button
          disabled={loading}
          className="w-full rounded bg-green-700 py-2 text-white hover:bg-green-800 disabled:opacity-50"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
