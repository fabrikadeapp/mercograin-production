'use client'
import * as React from 'react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'

interface Apurada {
  id: string
  contratoId: string
  valorContrato: string | number
  valorTotalComissao: string | number
  valorCorretor: string | number
  valorOriginador: string | number
  valorMesa: string | number
  valorHouse: string | number
  status: string
  createdAt: string
  regra?: { id: string; nome: string } | null
}

interface Totais {
  contratos: number
  valorTotal: number
  valorCorretor: number
  valorOriginador: number
  valorMesa: number
  valorHouse: number
}

const fmt = (v: any) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ComissoesFinanceiroPage() {
  const [data, setData] = React.useState<Apurada[]>([])
  const [total, setTotal] = React.useState<Totais | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [apurando, setApurando] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)

  async function recarregar() {
    setLoading(true)
    const r = await fetch('/api/comissao/apuradas').then((r) => r.json())
    setData(r.data || [])
    setTotal(r.total || null)
    setLoading(false)
  }
  React.useEffect(() => {
    recarregar()
  }, [])

  async function apurarAgora() {
    setApurando(true)
    setMsg(null)
    // requer CRON_SECRET — neste ambiente, admin chama via endpoint manual.
    // Fallback UX: avisa o usuário.
    const secret = window.prompt('Informe CRON_SECRET para apurar agora:')
    if (!secret) {
      setApurando(false)
      return
    }
    const r = await fetch('/api/cron/apurar-comissoes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    const j = await r.json()
    setMsg(
      r.ok
        ? `Processados: ${j.processados} • Criados: ${j.criados} • Pulados: ${j.pulados}`
        : `Erro: ${j.error ?? 'desconhecido'}`
    )
    setApurando(false)
    if (r.ok) recarregar()
  }

  return (
    <AppShell>
      <PageHeader
        title="Comissões"
        subtitle="Comissões apuradas por contrato assinado."
      />

      <Card className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={apurarAgora} disabled={apurando}>
            {apurando ? 'Apurando…' : 'Apurar agora'}
          </Button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </Card>

      {total && (
        <Card className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
            <div>
              <div className="text-mute">Contratos</div>
              <div className="font-bold">{total.contratos}</div>
            </div>
            <div>
              <div className="text-mute">Total</div>
              <div className="font-bold">{fmt(total.valorTotal)}</div>
            </div>
            <div>
              <div className="text-mute">Corretor</div>
              <div>{fmt(total.valorCorretor)}</div>
            </div>
            <div>
              <div className="text-mute">Originador</div>
              <div>{fmt(total.valorOriginador)}</div>
            </div>
            <div>
              <div className="text-mute">Mesa</div>
              <div>{fmt(total.valorMesa)}</div>
            </div>
            <div>
              <div className="text-mute">House</div>
              <div>{fmt(total.valorHouse)}</div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <p>Carregando…</p>
        ) : data.length === 0 ? (
          <p className="text-mute">Nenhuma comissão apurada ainda.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th>Data</th>
                  <th>Contrato</th>
                  <th>Regra</th>
                  <th>V. Contrato</th>
                  <th>V. Total</th>
                  <th>Corretor</th>
                  <th>Orig.</th>
                  <th>Mesa</th>
                  <th>House</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="font-mono text-xs">
                      {c.contratoId.slice(0, 8)}…
                    </td>
                    <td>{c.regra?.nome ?? '—'}</td>
                    <td>{fmt(c.valorContrato)}</td>
                    <td className="font-bold">{fmt(c.valorTotalComissao)}</td>
                    <td>{fmt(c.valorCorretor)}</td>
                    <td>{fmt(c.valorOriginador)}</td>
                    <td>{fmt(c.valorMesa)}</td>
                    <td>{fmt(c.valorHouse)}</td>
                    <td>{c.status}</td>
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
