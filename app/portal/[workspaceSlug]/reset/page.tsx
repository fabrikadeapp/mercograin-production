'use client'

import { Suspense, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

function ResetForm() {
  const params = useParams<{ workspaceSlug: string }>()
  const sp = useSearchParams()
  const router = useRouter()
  const token = sp.get('token') ?? ''
  const emailInicial = sp.get('email') ?? ''
  const [email, setEmail] = useState(emailInicial)
  const [s1, setS1] = useState('')
  const [s2, setS2] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (s1 !== s2) { setErro('As senhas não conferem.'); return }
    setBusy(true); setErro(null)
    try {
      const r = await fetch('/api/portal/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, novaSenha: s1 }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.error ?? 'Erro ao redefinir senha.'); return }
      setSucesso(true)
      setTimeout(() => router.push(`/portal/${params.workspaceSlug}`), 1200)
    } finally {
      setBusy(false)
    }
  }

  if (sucesso) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="max-w-sm rounded-lg bg-white p-6 shadow text-center">
          <h2 className="text-lg font-semibold text-green-700">Senha redefinida</h2>
          <p className="text-sm text-gray-600 mt-2">Redirecionando…</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold">Definir nova senha</h1>
        <p className="text-sm text-gray-500">Crie uma nova senha para seu acesso.</p>
        <label className="block">
          <span className="text-xs text-gray-600">Email</span>
          <input className="mt-1 w-full rounded border px-3 py-2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">Nova senha (mín. 8, com maiúscula, minúscula e número)</span>
          <input className="mt-1 w-full rounded border px-3 py-2" type="password" required value={s1} onChange={(e) => setS1(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">Confirme a senha</span>
          <input className="mt-1 w-full rounded border px-3 py-2" type="password" required value={s2} onChange={(e) => setS2(e.target.value)} />
        </label>
        {erro && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{erro}</div>}
        <button type="submit" disabled={busy || s1.length < 8} className="w-full rounded bg-green-700 px-3 py-2 font-semibold text-white disabled:bg-gray-400">
          {busy ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  )
}

export const dynamic = 'force-dynamic'

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  )
}
