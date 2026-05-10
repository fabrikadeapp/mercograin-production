'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/phb'

export function ConciliacaoUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const upload = async (persistir: boolean) => {
    if (!file) return
    setLoading(true)
    setErro(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('persistir', persistir ? 'true' : 'false')
      const r = await fetch('/api/conciliacao/upload', {
        method: 'POST',
        body: fd,
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setResultado(j)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept=".ofx,.OFX,application/x-ofx"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button
          variant="ghost"
          disabled={!file || loading}
          onClick={() => upload(false)}
        >
          {loading ? 'Processando...' : 'Pré-visualizar'}
        </Button>
        <Button
          variant="primary"
          disabled={!file || loading}
          onClick={() => upload(true)}
        >
          {loading ? 'Importando...' : 'Importar e conciliar'}
        </Button>
      </div>
      {erro && <p className="text-red-600 text-xs">{erro}</p>}
      {resultado && (
        <div className="text-xs">
          <p className="font-medium mb-2">
            {resultado.total} transação(ões) lidas{' '}
            {resultado.persistido ? '(persistido)' : '(preview)'}
          </p>
          <table className="w-full">
            <thead>
              <tr className="text-zinc-500 border-b">
                <th className="text-left py-1">Data</th>
                <th className="text-left">Descrição</th>
                <th className="text-right">Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {resultado.resultados.map((r: any, i: number) => (
                <tr key={i} className="border-b last:border-0">
                  <td>{new Date(r.ofx.data).toLocaleDateString('pt-BR')}</td>
                  <td className="max-w-[200px] truncate">{r.ofx.descricao}</td>
                  <td className="text-right font-mono">
                    {Number(r.ofx.valor).toFixed(2)}
                  </td>
                  <td>
                    <span
                      className={
                        'px-2 py-0.5 rounded ' +
                        (r.status === 'duplicado'
                          ? 'bg-zinc-100'
                          : r.status === 'conciliado' || r.status === 'criado'
                            ? 'bg-emerald-100 text-emerald-700'
                            : r.status === 'sem_match'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-orange-100 text-orange-700')
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
