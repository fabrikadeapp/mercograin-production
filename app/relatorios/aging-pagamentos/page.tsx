'use client'
import * as React from 'react'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'

interface Faixa {
  faixa: string
  qtd: number
  valor: number
  items: Array<{
    id: string
    descricao: string
    natureza: string
    valor: number
    data: string
    diasAtraso: number
  }>
}

const fmt = (v: any) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AgingPagamentosPage() {
  const [data, setData] = React.useState<{
    total: { qtd: number; valor: number }
    faixas: Faixa[]
  } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [natureza, setNatureza] = React.useState('')

  async function recarregar() {
    setLoading(true)
    const url = natureza
      ? `/api/relatorios/aging-pagamentos?natureza=${natureza}`
      : '/api/relatorios/aging-pagamentos'
    const r = await fetch(url).then((r) => r.json())
    setData(r)
    setLoading(false)
  }
  React.useEffect(() => {
    recarregar()
  }, [natureza])

  return (
    <AppShell>
      <PageHeader
        title="Aging de Pagamentos"
        subtitle="Despesas não conciliadas por faixa de atraso."
      />

      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm">Natureza:</label>
          <select
            className="input"
            value={natureza}
            onChange={(e) => setNatureza(e.target.value)}
          >
            <option value="">todas</option>
            <option value="comissao">comissão</option>
            <option value="frete">frete</option>
            <option value="corretagem">corretagem</option>
            <option value="imposto">imposto</option>
            <option value="salario">salário</option>
            <option value="outros">outros</option>
          </select>
        </div>
      </Card>

      {loading ? (
        <p>Carregando…</p>
      ) : !data ? (
        <p>Sem dados.</p>
      ) : (
        <>
          <Card className="mb-4">
            <div className="text-sm text-mute">Total despesas pendentes</div>
            <div className="text-h2">{fmt(data.total.valor)}</div>
            <div className="text-mute text-sm">{data.total.qtd} movimento(s)</div>
          </Card>

          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th>Faixa</th>
                  <th>Qtd</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.faixas.map((f) => (
                  <tr key={f.faixa} className="border-t border-border">
                    <td>{f.faixa}</td>
                    <td>{f.qtd}</td>
                    <td>{fmt(f.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </AppShell>
  )
}
