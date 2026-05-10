'use client'
import * as React from 'react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'

interface Corretor {
  id: string
  nome: string
  email?: string | null
  whatsapp?: string | null
  cpf?: string | null
  comissaoPct: number
  mesa?: { id: string; nome: string } | null
  ativo: boolean
}

interface Mesa { id: string; nome: string }

export default function CorretoresAdminPage() {
  const [data, setData] = React.useState<Corretor[]>([])
  const [mesas, setMesas] = React.useState<Mesa[]>([])
  const [loading, setLoading] = React.useState(true)
  const [novo, setNovo] = React.useState({ nome: '', email: '', whatsapp: '', cpf: '', mesaId: '', comissaoPct: 0.5 })
  const [erro, setErro] = React.useState<string | null>(null)

  async function recarregar() {
    setLoading(true)
    const [cr, mr] = await Promise.all([
      fetch('/api/corretores').then((r) => r.json()),
      fetch('/api/mesas').then((r) => r.json()),
    ])
    setData(cr.data || [])
    setMesas(mr.data || [])
    setLoading(false)
  }
  React.useEffect(() => {
    recarregar()
  }, [])

  async function criar() {
    setErro(null)
    if (!novo.nome) {
      setErro('Nome obrigatório')
      return
    }
    const body: any = {
      nome: novo.nome,
      comissaoPct: Number(novo.comissaoPct),
    }
    if (novo.email) body.email = novo.email
    if (novo.whatsapp) body.whatsapp = novo.whatsapp
    if (novo.cpf) body.cpf = novo.cpf
    if (novo.mesaId) body.mesaId = novo.mesaId
    const r = await fetch('/api/corretores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await r.json()
    if (!r.ok) {
      setErro(j?.error || 'Erro')
      return
    }
    setNovo({ nome: '', email: '', whatsapp: '', cpf: '', mesaId: '', comissaoPct: 0.5 })
    recarregar()
  }

  async function remover(id: string) {
    if (!confirm('Remover corretor?')) return
    await fetch(`/api/corretores/${id}`, { method: 'DELETE' })
    recarregar()
  }

  return (
    <AppShell>
      <PageHeader title="Corretores" subtitle="Cadastro e vínculo de mesa + comissão." />

      <Card className="mb-6">
        <h3 className="text-h3 mb-3">Novo corretor</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="input w-full" placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <input className="input w-full" placeholder="Email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
          <input className="input w-full" placeholder="WhatsApp" value={novo.whatsapp} onChange={(e) => setNovo({ ...novo, whatsapp: e.target.value })} />
          <input className="input w-full" placeholder="CPF" value={novo.cpf} onChange={(e) => setNovo({ ...novo, cpf: e.target.value })} />
          <select className="input w-full" value={novo.mesaId} onChange={(e) => setNovo({ ...novo, mesaId: e.target.value })}>
            <option value="">Sem mesa</option>
            {mesas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <input className="input w-full" type="number" step="0.01" placeholder="Comissão %" value={novo.comissaoPct} onChange={(e) => setNovo({ ...novo, comissaoPct: Number(e.target.value) })} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={criar}>Criar</Button>
          {erro && <span className="text-danger text-sm">{erro}</span>}
        </div>
      </Card>

      <Card>
        {loading ? <p>Carregando…</p> : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left"><th>Nome</th><th>Email</th><th>WhatsApp</th><th>CPF</th><th>Mesa</th><th>Comissão %</th><th>Ativo</th><th></th></tr></thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td>{c.nome}</td><td>{c.email}</td><td>{c.whatsapp}</td><td>{c.cpf}</td>
                    <td>{c.mesa?.nome ?? '—'}</td>
                    <td>{c.comissaoPct}</td>
                    <td>{c.ativo ? 'sim' : 'não'}</td>
                    <td><button className="text-danger" onClick={() => remover(c.id)}>remover</button></td>
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
