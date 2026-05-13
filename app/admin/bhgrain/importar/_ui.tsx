'use client'
import { useState } from 'react'
import { Upload, AlertTriangle, CheckCircle2, FileText } from 'lucide-react'

interface PreviewResult {
  commit: false
  total: number
  validosCount: number
  errosCount: number
  mapping: Record<string, string | null>
  sample: { nome: string; tipo: string; cnpj: string | null; cpf: string | null; email: string | null }[]
  erros: { linha: number; campo: string; motivo: string; valor: string }[]
}

interface CommitResult {
  commit: true
  total: number
  validos: number
  inseridos: number
  pulados: number
  errosCount: number
  erros: { linha: number; campo: string; motivo: string; valor: string }[]
}

type Result = PreviewResult | CommitResult

export function ImportarClientes() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(commit: boolean) {
    if (!file) {
      setError('Selecione um arquivo CSV')
      return
    }
    setLoading(true)
    setError(null)
    if (!commit) setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const url = `/api/bhgrain/import/clientes${commit ? '?commit=1' : ''}`
      const res = await fetch(url, { method: 'POST', body: fd })
      const j = (await res.json()) as Result | { error: string }
      if (!res.ok) throw new Error('error' in j ? j.error : 'Erro')
      setResult(j as Result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="cursor-pointer flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded px-4 py-2 transition">
          <Upload className="w-4 h-4" />
          <span>Escolher CSV</span>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setResult(null)
              setError(null)
            }}
          />
        </label>
        {file && (
          <div className="flex items-center gap-2 text-sm opacity-80">
            <FileText className="w-4 h-4" />
            <span>{file.name}</span>
            <span className="opacity-60">({Math.round(file.size / 1024)} KB)</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => upload(false)}
          disabled={!file || loading}
          className="bg-white/10 hover:bg-white/15 text-sm rounded px-3 py-2 disabled:opacity-40"
        >
          {loading ? 'Analisando…' : 'Pré-visualizar'}
        </button>
        {result && !result.commit && result.validosCount > 0 && (
          <button
            type="button"
            onClick={() => upload(true)}
            disabled={loading}
            className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded px-3 py-2"
          >
            {loading ? 'Importando…' : `Importar ${result.validosCount} clientes`}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {result?.commit === true && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-sm space-y-1">
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Importação concluída
          </div>
          <div className="text-xs opacity-80">
            Total no arquivo: {result.total} · Válidos: {result.validos} · <strong>Inseridos: {result.inseridos}</strong>
            {' · '}Pulados (duplicatas): {result.pulados} · Erros: {result.errosCount}
          </div>
        </div>
      )}

      {result?.commit === false && (
        <div className="space-y-3">
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-sm">
            <div className="font-semibold mb-1">Preview</div>
            <div className="text-xs opacity-80">
              Total: {result.total} · Válidos: <strong>{result.validosCount}</strong> · Erros: {result.errosCount}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold opacity-70 mb-1">Mapeamento de colunas detectado</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {Object.entries(result.mapping).map(([k, v]) => (
                <div key={k} className="bg-black/20 rounded p-2">
                  <div className="opacity-60">{k}</div>
                  <div className="font-medium truncate">{v ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {result.sample.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold opacity-70 mb-1">Amostra dos primeiros 10 válidos</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left opacity-60">
                    <th className="py-1">Nome</th>
                    <th className="py-1">Tipo</th>
                    <th className="py-1">CNPJ/CPF</th>
                    <th className="py-1">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sample.map((s, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="py-1">{s.nome}</td>
                      <td className="py-1 opacity-70">{s.tipo}</td>
                      <td className="py-1 opacity-70">{s.cnpj ?? s.cpf ?? '—'}</td>
                      <td className="py-1 opacity-70">{s.email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.erros.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-400 mb-1">Primeiros erros ({result.errosCount} no total)</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left opacity-60">
                    <th className="py-1">Linha</th>
                    <th className="py-1">Campo</th>
                    <th className="py-1">Motivo</th>
                    <th className="py-1">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {result.erros.map((e, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="py-1 tabular-nums">{e.linha}</td>
                      <td className="py-1">{e.campo}</td>
                      <td className="py-1 text-red-300">{e.motivo}</td>
                      <td className="py-1 opacity-60 truncate max-w-xs">{e.valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
