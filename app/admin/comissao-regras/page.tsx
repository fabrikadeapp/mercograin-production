'use client'
import * as React from 'react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'

interface Regra {
  id: string
  nome: string
  descricao?: string | null
  escopoTipo?: string | null
  escopoFiltro?: any
  pctTotal: number
  pctCorretor: number
  pctOriginador?: number | null
  pctMesa?: number | null
  pctHouse?: number | null
  ativo: boolean
  prioridade: number
}

const ESCOPOS = ['global', 'cultura', 'mesa', 'corretor', 'cliente']

export default function ComissaoRegrasPage() {
  const [data, setData] = React.useState<Regra[]>([])
  const [loading, setLoading] = React.useState(true)
  const [erro, setErro] = React.useState<string | null>(null)
  const [novo, setNovo] = React.useState({
    nome: '',
    descricao: '',
    escopoTipo: 'global',
    escopoFiltro: '',
    pctTotal: 1.5,
    pctCorretor: 0.5,
    pctOriginador: 0,
    pctMesa: 0,
    pctHouse: 0,
    prioridade: 0,
  })

  async function recarregar() {
    setLoading(true)
    const r = await fetch('/api/comissao/regras').then((r) => r.json())
    setData(r.data || [])
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
    let escopoFiltro: any = null
    if (novo.escopoFiltro.trim()) {
      try {
        escopoFiltro = JSON.parse(novo.escopoFiltro)
      } catch {
        setErro('escopoFiltro deve ser JSON válido')
        return
      }
    }
    const body: any = {
      nome: novo.nome,
      descricao: novo.descricao || null,
      escopoTipo: novo.escopoTipo,
      escopoFiltro,
      pctTotal: Number(novo.pctTotal),
      pctCorretor: Number(novo.pctCorretor),
      pctOriginador: Number(novo.pctOriginador) || null,
      pctMesa: Number(novo.pctMesa) || null,
      pctHouse: Number(novo.pctHouse) || null,
      prioridade: Number(novo.prioridade) || 0,
    }
    const r = await fetch('/api/comissao/regras', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const j = await r.json()
    if (!r.ok) {
      setErro(j?.error || 'Erro')
      return
    }
    setNovo({
      nome: '',
      descricao: '',
      escopoTipo: 'global',
      escopoFiltro: '',
      pctTotal: 1.5,
      pctCorretor: 0.5,
      pctOriginador: 0,
      pctMesa: 0,
      pctHouse: 0,
      prioridade: 0,
    })
    recarregar()
  }

  async function toggleAtivo(r: Regra) {
    await fetch(`/api/comissao/regras/${r.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ativo: !r.ativo }),
    })
    recarregar()
  }

  async function remover(id: string) {
    if (!confirm('Remover regra?')) return
    await fetch(`/api/comissao/regras/${id}`, { method: 'DELETE' })
    recarregar()
  }

  return (
    <AppShell>
      <PageHeader
        title="Regras de Comissão"
        subtitle="Comissão hierárquica: corretor + originador + mesa + house."
      />

      <Card className="mb-6">
        <h3 className="text-h3 mb-3">Nova regra</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="input w-full"
            placeholder="Nome"
            value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
          />
          <select
            className="input w-full"
            value={novo.escopoTipo}
            onChange={(e) => setNovo({ ...novo, escopoTipo: e.target.value })}
          >
            {ESCOPOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            className="input w-full"
            placeholder='Filtro JSON ex: {"cultura":"soja"}'
            value={novo.escopoFiltro}
            onChange={(e) => setNovo({ ...novo, escopoFiltro: e.target.value })}
          />
          <input
            className="input w-full"
            type="number"
            step="0.01"
            placeholder="% Total"
            value={novo.pctTotal}
            onChange={(e) => setNovo({ ...novo, pctTotal: Number(e.target.value) })}
          />
          <input
            className="input w-full"
            type="number"
            step="0.01"
            placeholder="% Corretor"
            value={novo.pctCorretor}
            onChange={(e) => setNovo({ ...novo, pctCorretor: Number(e.target.value) })}
          />
          <input
            className="input w-full"
            type="number"
            step="0.01"
            placeholder="% Originador"
            value={novo.pctOriginador}
            onChange={(e) =>
              setNovo({ ...novo, pctOriginador: Number(e.target.value) })
            }
          />
          <input
            className="input w-full"
            type="number"
            step="0.01"
            placeholder="% Mesa"
            value={novo.pctMesa}
            onChange={(e) => setNovo({ ...novo, pctMesa: Number(e.target.value) })}
          />
          <input
            className="input w-full"
            type="number"
            step="0.01"
            placeholder="% House"
            value={novo.pctHouse}
            onChange={(e) => setNovo({ ...novo, pctHouse: Number(e.target.value) })}
          />
          <input
            className="input w-full"
            type="number"
            placeholder="Prioridade"
            value={novo.prioridade}
            onChange={(e) =>
              setNovo({ ...novo, prioridade: Number(e.target.value) })
            }
          />
          <input
            className="input w-full md:col-span-3"
            placeholder="Descrição"
            value={novo.descricao}
            onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={criar}>Criar</Button>
          {erro && <span className="text-danger text-sm">{erro}</span>}
        </div>
      </Card>

      <Card>
        {loading ? (
          <p>Carregando…</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th>Nome</th>
                  <th>Escopo</th>
                  <th>% Total</th>
                  <th>% Corretor</th>
                  <th>% Orig.</th>
                  <th>% Mesa</th>
                  <th>% House</th>
                  <th>Prio.</th>
                  <th>Ativo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td>{r.nome}</td>
                    <td>{r.escopoTipo ?? 'global'}</td>
                    <td>{r.pctTotal}</td>
                    <td>{r.pctCorretor}</td>
                    <td>{r.pctOriginador ?? '—'}</td>
                    <td>{r.pctMesa ?? '—'}</td>
                    <td>{r.pctHouse ?? '—'}</td>
                    <td>{r.prioridade}</td>
                    <td>
                      <button onClick={() => toggleAtivo(r)}>
                        {r.ativo ? 'sim' : 'não'}
                      </button>
                    </td>
                    <td>
                      <button className="text-danger" onClick={() => remover(r.id)}>
                        remover
                      </button>
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
