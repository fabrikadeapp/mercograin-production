'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, Download, Loader2 } from 'lucide-react'

interface Boleto {
  id: string
  numero: string
  valor: number
  vencimento: string
  status: string
  confirmadoEm: string | null
  linkBoleto: string | null
  banco: string
  contratoNumero: string | null
}
interface Resp {
  ok: true
  boletos: Boleto[]
  resumo: { totalAberto: number; totalVencido: number; totalPago: number }
}

type Filtro = 'todos' | 'aberto' | 'vencido' | 'pago'

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (s: string) => new Date(s).toLocaleDateString('pt-BR')

export function RecebiveisView() {
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/portal/recebiveis')
      .then((r) => r.json())
      .then((j) => setData(j))
      .finally(() => setLoading(false))
  }, [])

  const filtrados = useMemo(() => {
    if (!data) return []
    if (filtro === 'todos') return data.boletos
    return data.boletos.filter((b) => b.status === filtro)
  }, [data, filtro])

  async function copiar(numero: string) {
    try {
      await navigator.clipboard.writeText(numero)
      setCopiado(numero)
      setTimeout(() => setCopiado(null), 1500)
    } catch {
      // fallback simples
      const ta = document.createElement('textarea')
      ta.value = numero
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiado(numero)
      setTimeout(() => setCopiado(null), 1500)
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-gray-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando boletos…
      </div>
    )
  }
  if (!data) {
    return <p className="text-red-700">Erro ao carregar.</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Recebíveis</h1>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi label="Em aberto" valor={data.resumo.totalAberto} cor="#1a73e8" />
        <Kpi label="Vencido" valor={data.resumo.totalVencido} cor="#c0392b" />
        <Kpi label="Pago" valor={data.resumo.totalPago} cor="#0a8a3a" />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['todos', 'aberto', 'vencido', 'pago'] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={
              'rounded border px-3 py-1 text-sm capitalize ' +
              (filtro === f
                ? 'border-green-700 bg-green-50 text-green-800'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')
            }
          >
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Número</th>
              <th className="p-2">Contrato</th>
              <th className="p-2">Vencimento</th>
              <th className="p-2 text-right">Valor</th>
              <th className="p-2">Banco</th>
              <th className="p-2">Status</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((b) => (
              <tr key={b.id} className="border-t align-middle">
                <td className="p-2 font-mono text-xs">{b.numero}</td>
                <td className="p-2">{b.contratoNumero ?? '-'}</td>
                <td className="p-2">{fmtData(b.vencimento)}</td>
                <td className="p-2 text-right font-medium">{fmtBRL(b.valor)}</td>
                <td className="p-2">{b.banco}</td>
                <td className="p-2">
                  <StatusBadge status={b.status} />
                </td>
                <td className="p-2">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => copiar(b.numero)}
                      title="Copiar número"
                      className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                    >
                      <Copy className="inline h-3 w-3" />
                      {copiado === b.numero ? ' Copiado' : ' Copiar'}
                    </button>
                    {b.linkBoleto && (
                      <a
                        href={b.linkBoleto}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border bg-green-50 px-2 py-1 text-xs text-green-800 hover:bg-green-100"
                      >
                        <Download className="inline h-3 w-3" /> Baixar
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  Sem boletos nesta categoria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kpi({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold" style={{ color: cor }}>
        {fmtBRL(valor)}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    aberto: { bg: '#e8f0fe', fg: '#1a73e8', label: 'Em aberto' },
    pendente: { bg: '#e8f0fe', fg: '#1a73e8', label: 'Pendente' },
    vencido: { bg: '#fdecea', fg: '#c0392b', label: 'Vencido' },
    pago: { bg: '#eaf7ee', fg: '#0a8a3a', label: 'Pago' },
    cancelado: { bg: '#f5f5f5', fg: '#777', label: 'Cancelado' },
  }
  const v = map[status] ?? { bg: '#f5f5f5', fg: '#555', label: status }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: v.bg, color: v.fg }}
    >
      {v.label}
    </span>
  )
}
