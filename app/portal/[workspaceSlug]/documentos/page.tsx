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

interface ContratoCard {
  id: string
  numero: string
  statusAssinatura: string
  assinadoEm: string | null
  propostaNumero: string | null
  propostaValor: number | null
  downloadContrato: string
  downloadEvidencias: string
}

export default function DocumentosPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [contratos, setContratos] = useState<ContratoCard[]>([])
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState('outro')
  const [file, setFile] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    const [docsR, ctsR] = await Promise.all([
      fetch('/api/portal/documentos'),
      fetch('/api/portal/contratos-assinados'),
    ])
    if (docsR.ok) {
      const j = await docsR.json()
      setDocs(j.documentos)
    }
    if (ctsR.ok) {
      const j = await ctsR.json()
      setContratos(j.contratos ?? [])
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

      {contratos.length > 0 && (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="font-medium mb-3">Meus contratos</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {contratos.map((c) => (
              <div key={c.id} className="rounded border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-gray-500">{c.numero}</div>
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                      (c.statusAssinatura === 'assinado'
                        ? 'bg-green-50 text-green-800'
                        : c.statusAssinatura === 'enviada'
                        ? 'bg-blue-50 text-blue-800'
                        : 'bg-gray-100 text-gray-700')
                    }
                  >
                    {c.statusAssinatura}
                  </span>
                </div>
                <div className="mt-1 font-medium">
                  {c.propostaNumero ? `Proposta ${c.propostaNumero}` : 'Sem proposta'}
                </div>
                {c.propostaValor != null && (
                  <div className="text-xs text-gray-600">
                    Valor:{' '}
                    {c.propostaValor.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </div>
                )}
                {c.assinadoEm && (
                  <div className="text-xs text-gray-500">
                    Assinado em {new Date(c.assinadoEm).toLocaleString('pt-BR')}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={c.downloadContrato}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border bg-gray-50 px-2 py-1 text-xs hover:bg-gray-100"
                  >
                    Baixar contrato
                  </a>
                  {c.statusAssinatura === 'assinado' && (
                    <a
                      href={c.downloadEvidencias}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border bg-green-50 px-2 py-1 text-xs text-green-800 hover:bg-green-100"
                    >
                      Página de evidências
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
