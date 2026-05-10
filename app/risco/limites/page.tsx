'use client'
import * as React from 'react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'

interface Limite {
  id: string
  escopo: string
  tipo: string
  escopoFiltro: any
  valorMaximo: string | number
  valorAviso: string | number | null
  ativo: boolean
  observacao?: string | null
}

export default function LimitesPage() {
  const [limites, setLimites] = React.useState<Limite[]>([])
  const [breaches, setBreaches] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [novo, setNovo] = React.useState({
    escopo: 'total',
    tipo: 'exposicao_usd',
    valorMaximo: '',
    valorAviso: '',
    escopoFiltro: '',
    observacao: '',
  })
  const [erro, setErro] = React.useState<string | null>(null)

  async function recarregar() {
    setLoading(true)
    const [lr, br] = await Promise.all([
      fetch('/api/risco/limites').then((r) => r.json()),
      fetch('/api/risco/exposicao').then((r) => r.json()),
    ])
    setLimites(lr.data || [])
    setBreaches(br.breaches || [])
    setLoading(false)
  }
  React.useEffect(() => {
    recarregar()
  }, [])

  async function criar() {
    setErro(null)
    try {
      const body: any = {
        escopo: novo.escopo,
        tipo: novo.tipo,
        valorMaximo: Number(novo.valorMaximo),
      }
      if (novo.valorAviso) body.valorAviso = Number(novo.valorAviso)
      if (novo.escopoFiltro) body.escopoFiltro = JSON.parse(novo.escopoFiltro)
      if (novo.observacao) body.observacao = novo.observacao
      const r = await fetch('/api/risco/limites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || 'Erro')
      setNovo({ escopo: 'total', tipo: 'exposicao_usd', valorMaximo: '', valorAviso: '', escopoFiltro: '', observacao: '' })
      recarregar()
    } catch (e: any) {
      setErro(e.message)
    }
  }

  async function remover(id: string) {
    if (!confirm('Remover limite?')) return
    await fetch(`/api/risco/limites/${id}`, { method: 'DELETE' })
    recarregar()
  }

  function statusDoLimite(l: Limite): string {
    const b = breaches.find((x: any) => x.limiteId === l.id)
    if (!b) return 'OK'
    const pct = ((b.valorAtual / Number(l.valorMaximo)) * 100).toFixed(1)
    return `${b.severidade.toUpperCase()} ${pct}%`
  }

  return (
    <AppShell>
      <PageHeader title="Limites de risco" subtitle="Crie e gerencie limites por escopo + tipo." />

      <Card className="mb-6">
        <h3 className="text-h3 mb-3">Novo limite</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm">Escopo
            <select className="input w-full" value={novo.escopo} onChange={(e) => setNovo({ ...novo, escopo: e.target.value })}>
              <option value="total">Total</option>
              <option value="cultura">Cultura</option>
              <option value="corretor">Corretor</option>
              <option value="mesa">Mesa</option>
              <option value="contraparte">Contraparte</option>
              <option value="regiao">Região</option>
            </select>
          </label>
          <label className="text-sm">Tipo
            <select className="input w-full" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}>
              <option value="exposicao_usd">Exposição USD</option>
              <option value="exposicao_brl">Exposição BRL</option>
              <option value="qtd_sc">Qtd sacas</option>
              <option value="var_usd">VaR USD</option>
              <option value="pnl_neg_usd">P&L negativo USD</option>
            </select>
          </label>
          <label className="text-sm">Valor máximo
            <input type="number" className="input w-full" value={novo.valorMaximo} onChange={(e) => setNovo({ ...novo, valorMaximo: e.target.value })} />
          </label>
          <label className="text-sm">Valor aviso (opcional, default 80%)
            <input type="number" className="input w-full" value={novo.valorAviso} onChange={(e) => setNovo({ ...novo, valorAviso: e.target.value })} />
          </label>
          <label className="text-sm">Filtro (JSON, ex: {`{"cultura":"soja"}`})
            <input className="input w-full" value={novo.escopoFiltro} onChange={(e) => setNovo({ ...novo, escopoFiltro: e.target.value })} />
          </label>
          <label className="text-sm">Observação
            <input className="input w-full" value={novo.observacao} onChange={(e) => setNovo({ ...novo, observacao: e.target.value })} />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={criar}>Criar limite</Button>
          {erro && <span className="text-danger text-sm">{erro}</span>}
        </div>
      </Card>

      <Card>
        <h3 className="text-h3 mb-3">Limites ativos ({limites.length})</h3>
        {loading ? <p>Carregando…</p> : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th>Escopo</th><th>Tipo</th><th>Filtro</th><th>Máximo</th><th>Status</th><th>Ativo</th><th></th>
                </tr>
              </thead>
              <tbody>
                {limites.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td>{l.escopo}</td>
                    <td>{l.tipo}</td>
                    <td className="text-xs">{l.escopoFiltro ? JSON.stringify(l.escopoFiltro) : '—'}</td>
                    <td>{Number(l.valorMaximo).toLocaleString('pt-BR')}</td>
                    <td>{statusDoLimite(l)}</td>
                    <td>{l.ativo ? 'sim' : 'não'}</td>
                    <td><button className="text-danger" onClick={() => remover(l.id)}>remover</button></td>
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
