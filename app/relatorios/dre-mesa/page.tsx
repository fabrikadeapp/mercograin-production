'use client'
import * as React from 'react'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'

interface Row {
  mesaId: string | null
  mesaNome: string
  contratos: number
  receita: number
  comissao: number
  despesas: number
  resultado: number
}

const fmt = (v: any) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function DreMesaPage() {
  const [data, setData] = React.useState<{ rows: Row[]; totais: any } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [inicio, setInicio] = React.useState('')
  const [fim, setFim] = React.useState('')

  async function recarregar() {
    setLoading(true)
    const params = new URLSearchParams()
    if (inicio) params.set('inicio', inicio)
    if (fim) params.set('fim', fim)
    const r = await fetch(`/api/relatorios/dre-mesa?${params}`).then((r) => r.json())
    setData(r)
    setLoading(false)
  }
  React.useEffect(() => {
    recarregar()
  }, [])

  return (
    <AppShell>
      <PageHeader
        title="DRE por Mesa"
        subtitle="Receita, comissão, despesas e resultado por mesa de operação."
      />

      <Card className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm">Início:</label>
          <input
            type="date"
            className="input"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
          <label className="text-sm">Fim:</label>
          <input
            type="date"
            className="input"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
          />
          <button className="btn" onClick={recarregar}>
            Filtrar
          </button>
        </div>
      </Card>

      {loading ? (
        <p>Carregando…</p>
      ) : !data ? (
        <p>Sem dados.</p>
      ) : (
        <Card>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th>Mesa</th>
                  <th>Contratos</th>
                  <th>Receita</th>
                  <th>Comissão</th>
                  <th>Outras Despesas</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.mesaId ?? 'sem'} className="border-t border-border">
                    <td>{r.mesaNome}</td>
                    <td>{r.contratos}</td>
                    <td>{fmt(r.receita)}</td>
                    <td>{fmt(r.comissao)}</td>
                    <td>{fmt(r.despesas)}</td>
                    <td
                      className={
                        r.resultado >= 0 ? 'text-success' : 'text-danger'
                      }
                    >
                      {fmt(r.resultado)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-bold">
                  <td>Total</td>
                  <td>{data.totais.contratos}</td>
                  <td>{fmt(data.totais.receita)}</td>
                  <td>{fmt(data.totais.comissao)}</td>
                  <td>{fmt(data.totais.despesas)}</td>
                  <td
                    className={
                      data.totais.resultado >= 0
                        ? 'text-success'
                        : 'text-danger'
                    }
                  >
                    {fmt(data.totais.resultado)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  )
}
