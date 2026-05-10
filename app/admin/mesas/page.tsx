'use client'
import * as React from 'react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'

interface Mesa {
  id: string
  nome: string
  descricao?: string | null
  ativo: boolean
  _count?: { corretores: number }
}

export default function MesasAdminPage() {
  const [data, setData] = React.useState<Mesa[]>([])
  const [loading, setLoading] = React.useState(true)
  const [novo, setNovo] = React.useState({ nome: '', descricao: '' })
  const [erro, setErro] = React.useState<string | null>(null)

  async function recarregar() {
    setLoading(true)
    const r = await fetch('/api/mesas')
    const j = await r.json()
    setData(j.data || [])
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
    const r = await fetch('/api/mesas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(novo),
    })
    const j = await r.json()
    if (!r.ok) {
      setErro(j?.error || 'Erro')
      return
    }
    setNovo({ nome: '', descricao: '' })
    recarregar()
  }

  async function remover(id: string) {
    if (!confirm('Remover mesa?')) return
    await fetch(`/api/mesas/${id}`, { method: 'DELETE' })
    recarregar()
  }

  return (
    <AppShell>
      <PageHeader title="Mesas" subtitle="Cadastro de mesas de operação." />

      <Card className="mb-6">
        <h3 className="text-h3 mb-3">Nova mesa</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="input w-full" placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <input className="input w-full" placeholder="Descrição" value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
          <div className="flex items-center gap-3">
            <Button onClick={criar}>Criar</Button>
            {erro && <span className="text-danger text-sm">{erro}</span>}
          </div>
        </div>
      </Card>

      <Card>
        {loading ? <p>Carregando…</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th>Nome</th><th>Descrição</th><th>Corretores</th><th>Ativo</th><th></th></tr></thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td>{m.nome}</td>
                  <td>{m.descricao}</td>
                  <td>{m._count?.corretores ?? 0}</td>
                  <td>{m.ativo ? 'sim' : 'não'}</td>
                  <td><button className="text-danger" onClick={() => remover(m.id)}>remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  )
}
