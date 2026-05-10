'use client'
import * as React from 'react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'

interface Breach {
  id: string
  severidade: string
  escopo?: string
  tipo?: string
  valorAtual: number | string
  valorMaximo: number | string
  excedidoEm: number | string
  detectadoEm: string
  resolvidoEm: string | null
  observacao: string | null
  limite?: { escopo: string; tipo: string; escopoFiltro: any }
}

export default function BreachesPage() {
  const [status, setStatus] = React.useState<'aberto' | 'resolvido' | 'todos'>('aberto')
  const [data, setData] = React.useState<Breach[]>([])
  const [loading, setLoading] = React.useState(true)

  async function recarregar() {
    setLoading(true)
    const r = await fetch(`/api/risco/breaches?status=${status}`)
    const j = await r.json()
    setData(j.data || [])
    setLoading(false)
  }
  React.useEffect(() => {
    recarregar()
  }, [status])

  async function resolver(id: string) {
    const obs = prompt('Observação da resolução (opcional):') || ''
    await fetch(`/api/risco/breaches/${id}/resolver`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ observacao: obs }),
    })
    recarregar()
  }

  return (
    <AppShell>
      <PageHeader title="Breaches" subtitle="Limites de risco excedidos." />

      <Card className="mb-4">
        <div className="flex gap-2">
          {(['aberto', 'resolvido', 'todos'] as const).map((s) => (
            <Button key={s} variant={status === s ? 'primary' : 'ghost'} onClick={() => setStatus(s)}>
              {s}
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        {loading ? <p>Carregando…</p> : data.length === 0 ? <p>Nenhum breach.</p> : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th>Severidade</th><th>Escopo/Tipo</th><th>Valor atual</th><th>Limite</th><th>Excedido</th><th>Detectado</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className={b.severidade === 'critico' ? 'text-danger' : b.severidade === 'breach' ? 'text-orange-500' : 'text-yellow-500'}>
                      {b.severidade}
                    </td>
                    <td>{b.limite?.escopo}/{b.limite?.tipo} {b.limite?.escopoFiltro ? <em className="text-xs">{JSON.stringify(b.limite.escopoFiltro)}</em> : null}</td>
                    <td>{Number(b.valorAtual).toLocaleString('pt-BR')}</td>
                    <td>{Number(b.valorMaximo).toLocaleString('pt-BR')}</td>
                    <td>{Number(b.excedidoEm).toFixed(2)}%</td>
                    <td>{new Date(b.detectadoEm).toLocaleString('pt-BR')}</td>
                    <td>{b.resolvidoEm ? 'resolvido' : 'aberto'}</td>
                    <td>
                      {!b.resolvidoEm && <button className="text-primary" onClick={() => resolver(b.id)}>resolver</button>}
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
