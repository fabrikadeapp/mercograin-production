'use client'
import * as React from 'react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'

interface VaRResultado {
  metodo: string
  varUSD: number
  varBRL: number
  confianca: number
  horizonte: number
  populacao: number
  exposicaoTotalUSD: number
  exposicaoTotalBRL: number
}

function fmtUSD(n: number) {
  return `US$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
function fmtBRL(n: number) {
  return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

export default function VarPage() {
  const [loading, setLoading] = React.useState(false)
  const [metodo, setMetodo] = React.useState<'todos' | 'parametrico' | 'historico' | 'monte_carlo'>('todos')
  const [confianca, setConfianca] = React.useState<0.95 | 0.99>(0.95)
  const [horizonte, setHorizonte] = React.useState(1)
  const [resp, setResp] = React.useState<{ resultados: VaRResultado[]; stress?: any; populacaoHistorico: number; posicoes: number; cambioAtualUsdBrl: number } | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  // stress test
  const [choqueSoja, setChoqueSoja] = React.useState(-10)
  const [choqueMilho, setChoqueMilho] = React.useState(-10)
  const [choqueTrigo, setChoqueTrigo] = React.useState(-10)
  const [choqueCambio, setChoqueCambio] = React.useState(10)

  async function calcular() {
    setLoading(true)
    setErro(null)
    try {
      const body: any = { metodo, confianca, horizonte }
      body.choques = [
        { cultura: 'soja', pct: choqueSoja / 100 },
        { cultura: 'milho', pct: choqueMilho / 100 },
        { cultura: 'trigo', pct: choqueTrigo / 100 },
        { cultura: 'cambio', pct: choqueCambio / 100 },
      ]
      const r = await fetch('/api/risco/var', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || 'Falha ao calcular VaR')
      setResp(data)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <PageHeader title="Calculadora VaR" subtitle="Value-at-Risk e stress test sobre carteira de hedge aberta." />
      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="text-sm">
            Método
            <select className="input w-full" value={metodo} onChange={(e) => setMetodo(e.target.value as any)}>
              <option value="todos">Todos</option>
              <option value="parametrico">Paramétrico</option>
              <option value="historico">Histórico</option>
              <option value="monte_carlo">Monte Carlo</option>
            </select>
          </label>
          <label className="text-sm">
            Confiança
            <select className="input w-full" value={String(confianca)} onChange={(e) => setConfianca(Number(e.target.value) as any)}>
              <option value="0.95">95%</option>
              <option value="0.99">99%</option>
            </select>
          </label>
          <label className="text-sm">
            Horizonte (dias)
            <input
              type="number"
              min={1}
              max={30}
              value={horizonte}
              onChange={(e) => setHorizonte(Number(e.target.value))}
              className="w-full input"
            />
          </label>
          <div className="flex items-end">
            <Button onClick={calcular} disabled={loading}>
              {loading ? 'Calculando…' : 'Calcular VaR'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <h3 className="text-h3 mb-3">Stress test — choques %</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <label>Soja %<input type="number" className="input w-full" value={choqueSoja} onChange={(e) => setChoqueSoja(Number(e.target.value))} /></label>
          <label>Milho %<input type="number" className="input w-full" value={choqueMilho} onChange={(e) => setChoqueMilho(Number(e.target.value))} /></label>
          <label>Trigo %<input type="number" className="input w-full" value={choqueTrigo} onChange={(e) => setChoqueTrigo(Number(e.target.value))} /></label>
          <label>Câmbio %<input type="number" className="input w-full" value={choqueCambio} onChange={(e) => setChoqueCambio(Number(e.target.value))} /></label>
        </div>
      </Card>

      {erro && <Card className="mb-6 text-danger">{erro}</Card>}

      {resp && (
        <>
          <p className="text-sm text-fg-2 mb-3">
            Posições abertas: {resp.posicoes} · Histórico: {resp.populacaoHistorico} dias · Câmbio atual: {resp.cambioAtualUsdBrl.toFixed(4)}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {resp.resultados.map((r) => (
              <Card key={r.metodo}>
                <p className="eyebrow">{r.metodo}</p>
                <h3 className="text-h3 mb-1">{fmtUSD(r.varUSD)}</h3>
                <p className="text-sm text-fg-2">{fmtBRL(r.varBRL)}</p>
                <p className="text-xs text-fg-2 mt-2">
                  Conf {Math.round(r.confianca * 100)}% · {r.horizonte}d · n={r.populacao}
                </p>
              </Card>
            ))}
          </div>
          {resp.stress && (
            <Card>
              <h3 className="text-h3 mb-2">Stress test</h3>
              <p>P&L em USD: <strong>{fmtUSD(resp.stress.pnlUSD)}</strong></p>
              <p>P&L em BRL: <strong>{fmtBRL(resp.stress.pnlBRL)}</strong></p>
              <pre className="text-xs text-fg-2 mt-2">{JSON.stringify(resp.stress.detalhes, null, 2)}</pre>
            </Card>
          )}
        </>
      )}
    </AppShell>
  )
}
