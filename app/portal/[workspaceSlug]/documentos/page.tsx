'use client'

import { useEffect, useState } from 'react'

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

export default function DocumentosPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState('outro')
  const [file, setFile] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    const r = await fetch('/api/portal/documentos')
    if (r.ok) {
      const j = await r.json()
      setDocs(j.documentos)
    }
  }
  useEffect(() => { load() }, [])

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
      const r = await fetch('/api/portal/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo, tipo, fileBase64, mimeType: file.type, fileName: file.name,
        }),
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

  async function remove(id: string) {
    if (!confirm('Remover documento?')) return
    await fetch(`/api/portal/documentos?id=${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Documentos</h1>
      <form onSubmit={upload} className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-medium">Enviar novo documento</h2>
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
          {loading ? 'Enviando…' : 'Enviar'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Título</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Origem</th>
              <th className="p-2">Tamanho</th>
              <th className="p-2">Enviado em</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="p-2">{d.titulo}</td>
                <td className="p-2">{d.tipo}</td>
                <td className="p-2">{d.enviadoPor}</td>
                <td className="p-2">{(d.tamanhoBytes / 1024).toFixed(0)} KB</td>
                <td className="p-2">{new Date(d.createdAt).toLocaleString('pt-BR')}</td>
                <td className="p-2 space-x-2">
                  {d.signedUrl && (
                    <a href={d.signedUrl} target="_blank" rel="noreferrer" className="text-green-700 hover:underline">Baixar</a>
                  )}
                  {d.enviadoPor === 'produtor' && (
                    <button onClick={() => remove(d.id)} className="text-red-600 hover:underline">Remover</button>
                  )}
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr><td colSpan={6} className="p-3 text-center text-gray-500">Cofre vazio.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
