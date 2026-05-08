'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card, Input, Select, Button } from '@/components/ui/phb'

interface Props {
  clientes: { id: string; nome: string }[]
}

const VENCIMENTOS_TIPICOS = (() => {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const out: { value: string; label: string }[] = []
  const today = new Date()
  for (let i = 1; i <= 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 15)
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`
    out.push({ value: ymd, label: `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}` })
  }
  return out
})()

export function NovoFuturoForm({ clientes }: Props) {
  const router = useRouter()
  const [grao, setGrao] = React.useState('soja')
  const [lado, setLado] = React.useState('compra')
  const [vencimento, setVencimento] = React.useState(VENCIMENTOS_TIPICOS[2].value)
  const [precoSc, setPrecoSc] = React.useState('')
  const [volumeSc, setVolumeSc] = React.useState('')
  const [praca, setPraca] = React.useState('')
  const [clienteId, setClienteId] = React.useState('')
  const [observacao, setObservacao] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const r = await fetch('/api/futuros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grao,
          lado,
          vencimento,
          precoSc: Number(precoSc.replace(',', '.')),
          volumeSc: Number(volumeSc),
          praca: praca || null,
          clienteId: clienteId || null,
          observacao: observacao || null,
          status: 'ativo',
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${r.status}`)
      }
      router.push('/futuros')
      router.refresh()
    } catch (e: any) {
      setError(e.message || 'Erro')
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-4">
          <p className="eyebrow">Contrato</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Grão"
              value={grao}
              onChange={(e) => setGrao(e.target.value)}
              options={[
                { value: 'soja', label: 'Soja' },
                { value: 'milho', label: 'Milho' },
                { value: 'trigo', label: 'Trigo' },
                { value: 'sorgo', label: 'Sorgo' },
              ]}
            />
            <Select
              label="Lado"
              value={lado}
              onChange={(e) => setLado(e.target.value)}
              options={[
                { value: 'compra', label: 'Compra (BID)' },
                { value: 'venda', label: 'Venda (ASK)' },
              ]}
            />
            <Select
              label="Vencimento"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              options={VENCIMENTOS_TIPICOS}
            />
            <Input
              label="Praça"
              value={praca}
              onChange={(e) => setPraca(e.target.value)}
              placeholder="Paranaguá / PR"
            />
          </div>
        </section>

        <section className="space-y-4">
          <p className="eyebrow">Preço e volume</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Preço (R$/sc 60kg)"
              value={precoSc}
              onChange={(e) => setPrecoSc(e.target.value)}
              placeholder="142,50"
              required
              rightAddon="R$/sc"
            />
            <Input
              label="Volume (sacas)"
              type="number"
              value={volumeSc}
              onChange={(e) => setVolumeSc(e.target.value)}
              placeholder="12500"
              required
              rightAddon="sc"
            />
          </div>
        </section>

        <section className="space-y-4">
          <p className="eyebrow">Cliente e observação</p>
          <div className="grid grid-cols-1 gap-4">
            <Select
              label="Cliente (opcional)"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              options={[
                { value: '', label: '— Nenhum —' },
                ...clientes.map(c => ({ value: c.id, label: c.nome })),
              ]}
            />
            <div>
              <p className="eyebrow mb-2">Observação</p>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: trigger de execução, condições especiais..."
                className="w-full min-h-24 bg-bg-2 border border-border-1 rounded-md p-3 text-fg-1 text-body placeholder:text-fg-3 outline-none focus:ring-2 focus:ring-accent transition-colors"
              />
            </div>
          </div>
        </section>

        {error ? (
          <p className="text-small" style={{ color: 'var(--neg)' }}>{error}</p>
        ) : null}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-1">
          <Button type="button" variant="ghost" onClick={() => router.push('/futuros')}>Cancelar</Button>
          <Button type="submit" loading={loading}>Salvar contrato futuro</Button>
        </div>
      </form>
    </Card>
  )
}
