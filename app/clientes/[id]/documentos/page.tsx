'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Doc {
  id: string
  titulo: string
  tipo: string
  mimeType: string
  tamanhoBytes: number
  createdAt: string
  enviadoPor: string
  signedUrl: string | null
}

export default function ClienteDocumentosPage() {
  const params = useParams<{ id: string }>()
  const [docs, setDocs] = useState<Doc[]>([])
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState('contrato')
  const [file, setFile] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [convidado, setConvidado] = useState<string | null>(null)

  async function load() {
    const r = await fetch(`/api/clientes/${params.id}/documentos`)
    if (r.ok) {
      const j = await r.json()
      setDocs(j.documentos)
    }
  }
  useEffect(() => { load() }, [params.id])

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!file || !titulo) return
    setLoading(true)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      let bin = ''
      buf.forEach((b) => (bin += String.fromCharCode(b)))
      const fileBase64 = btoa(bin)
      const r = await fetch(`/api/clientes/${params.id}/documentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, tipo, fileBase64, mimeType: file.type, fileName: file.name }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setErro(j.error ?? 'Erro')
        return
      }
      setTitulo(''); setFile(null)
      await load()
    } finally {
      setLoading(false)
    }
  }

  async function convidarPortal() {
    setErro(null)
    const r = await fetch(`/api/clientes/${params.id}/convidar-portal`, { method: 'POST' })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setErro(j.error ?? 'Erro')
      return
    }
    const j = await r.json()
    setConvidado(j.email)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Documentos do cliente</h1>
        <button onClick={convidarPortal} className="rounded bg-green-700 px-4 py-2 text-white">
          Convidar para portal
        </button>
      </div>
      {convidado && (
        <div className="rounded bg-green-50 p-2 text-sm text-green-800">
          Convite enviado para {convidado}.
        </div>
      )}

      <form onSubmit={upload} className="space-y-3 rounded-lg border bg-white p-4">
        <h2 className="font-medium">Enviar documento</h2>
        {erro && <div className="rounded bg-red-50 p-2 text-sm text-red-700">{erro}</div>}
        <div className="grid gap-3 md:grid-cols-3">
          <input className="rounded border px-3 py-2" placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
          <select className="rounded border px-3 py-2" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="contrato">Contrato</option>
            <option value="nf">Nota Fiscal</option>
            <option value="cpr">CPR</option>
            <option value="comprovante">Comprovante</option>
            <option value="outro">Outro</option>
          </select>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </div>
        <button disabled={loading || !file} className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50">
          {loading ? 'Enviando…' : 'Enviar para o cliente'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Título</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Origem</th>
              <th className="p-2">Enviado</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="p-2">{d.titulo}</td>
                <td className="p-2">{d.tipo}</td>
                <td className="p-2">{d.enviadoPor}</td>
                <td className="p-2">{new Date(d.createdAt).toLocaleString('pt-BR')}</td>
                <td className="p-2">
                  {d.signedUrl && (
                    <a href={d.signedUrl} target="_blank" rel="noreferrer" className="text-green-700 hover:underline">Baixar</a>
                  )}
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr><td colSpan={5} className="p-3 text-center text-gray-500">Sem documentos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
