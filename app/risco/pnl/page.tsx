'use client'
import * as React from 'react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'

interface PnLRow {
  chave: string
  nome: string
  pnlUSD: number
  pnlBRL: number
  qtdPosicoes: number
  qtdAbertas: number
  qtdFechadas: number
  rank?: number
  comissaoBRL?: number
}

function fmtUSD(n: number) {
  return `US$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
function fmtBRL(n: number) {
  return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

export default function PnLPage() {
  const [tab, setTab] = React.useState<'mesa' | 'corretor' | 'contrato' | 'ranking'>('mesa')
  const [data, setData] = React.useState<PnLRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    const endpoint =
      tab === 'mesa'
        ? '/api/risco/pnl-mesa'
        : tab === 'corretor'
          ? '/api/risco/pnl-corretor'
          : tab === 'contrato'
            ? '/api/risco/pnl-contrato'
            : '/api/risco/ranking-corretores'
    fetch(endpoint)
      .then((r) => r.json())
      .then((j) => setData(j.data || []))
      .finally(() => setLoading(false))
  }, [tab])

  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.pnlBRL)))

  return (
    <AppShell>
      <PageHeader title="P&L hierárquico" subtitle="Agregação por mesa, corretor ou contrato (realizado + unrealized)." />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          {(['mesa', 'corretor', 'contrato', 'ranking'] as const).map((t) => (
            <Button key={t} variant={tab === t ? 'primary' : 'ghost'} onClick={() => setTab(t)}>
              {t === 'ranking' ? 'Ranking corretores' : `Por ${t}`}
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        {loading ? <p>Carregando…</p> : data.length === 0 ? <p>Sem dados.</p> : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  {tab === 'ranking' && <th>#</th>}
                  <th>Nome</th>
                  <th>Posições</th>
                  <th>Abertas</th>
                  <th>Fechadas</th>
                  <th>P&L USD</th>
                  <th>P&L BRL</th>
                  {tab === 'ranking' && <th>Comissão BRL</th>}
                  <th>Barra</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.chave} className="border-t border-border">
                    {tab === 'ranking' && <td>{d.rank}</td>}
                    <td>{d.nome}</td>
                    <td>{d.qtdPosicoes}</td>
                    <td>{d.qtdAbertas}</td>
                    <td>{d.qtdFechadas}</td>
                    <td className={d.pnlUSD >= 0 ? 'text-success' : 'text-danger'}>{fmtUSD(d.pnlUSD)}</td>
                    <td className={d.pnlBRL >= 0 ? 'text-success' : 'text-danger'}>{fmtBRL(d.pnlBRL)}</td>
                    {tab === 'ranking' && <td>{fmtBRL(d.comissaoBRL || 0)}</td>}
                    <td>
                      <div className="w-32 h-2 bg-bg-2 relative">
                        <div
                          className={d.pnlBRL >= 0 ? 'bg-success h-full' : 'bg-danger h-full'}
                          style={{ width: `${Math.min(100, (Math.abs(d.pnlBRL) / maxAbs) * 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  )
}
