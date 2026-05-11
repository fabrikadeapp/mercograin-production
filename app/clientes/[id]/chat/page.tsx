'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

interface Msg {
  id: string
  remetente: 'corretora' | 'produtor'
  texto: string
  createdAt: string
}

export default function ClienteChatPage() {
  const params = useParams<{ id: string }>()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  async function load() {
    const r = await fetch(`/api/clientes/${params.id}/mensagens`)
    if (r.ok) {
      const j = await r.json()
      setMsgs(j.mensagens)
    }
  }
  useEffect(() => { load() }, [params.id])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setLoading(true)
    try {
      const r = await fetch(`/api/clientes/${params.id}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      })
      if (r.ok) { setTexto(''); await load() }
    } finally { setLoading(false) }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Chat com produtor</h1>
      <div className="flex h-[70vh] flex-col rounded-lg border bg-white">
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {msgs.map((m) => (
            <div
              key={m.id}
              className={
                'max-w-[75%] rounded-lg px-3 py-2 text-sm ' +
                (m.remetente === 'corretora'
                  ? 'ml-auto bg-green-600 text-white'
                  : 'mr-auto bg-gray-100 text-gray-900')
              }
            >
              <div>{m.texto}</div>
              <div className="mt-1 text-[10px] opacity-70">{new Date(m.createdAt).toLocaleString('pt-BR')}</div>
            </div>
          ))}
          {msgs.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">Sem mensagens.</div>
          )}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t p-3">
          <input className="flex-1 rounded border px-3 py-2" placeholder="Mensagem para o produtor…" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <button disabled={loading || !texto.trim()} className="rounded bg-green-700 px-4 text-white disabled:opacity-50">Enviar</button>
        </form>
      </div>
    </div>
  )
}
