'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell, PageHeader, Card, Button, Input } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

interface CC {
  id: string
  codigo: string
  nome: string
}

const NATUREZAS_RECEITA = [
  'venda_grao',
  'servico',
  'royalty',
  'comissao',
  'rendimento_financeiro',
  'outras_receitas',
]
const NATUREZAS_DESPESA = [
  'compra_grao',
  'frete',
  'armazenagem',
  'comissao',
  'imposto',
  'pessoal',
  'manutencao',
  'outras_despesas',
]

export default function NovoMovimentoPage() {
  const router = useRouter()
  const toast = useToast()
  const [centros, setCentros] = React.useState<CC[]>([])

  const today = new Date().toISOString().slice(0, 10)
  const [data, setData] = React.useState(today)
  const [tipo, setTipo] = React.useState<'receita' | 'despesa' | 'transferencia'>('despesa')
  const [natureza, setNatureza] = React.useState('outras_despesas')
  const [valor, setValor] = React.useState('')
  const [descricao, setDescricao] = React.useState('')
  const [centroCustoId, setCentroCustoId] = React.useState('')
  const [observacoes, setObservacoes] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/centros-custo')
      .then((r) => r.json())
      .then((j) => setCentros(Array.isArray(j?.data) ? j.data : []))
      .catch(() => setCentros([]))
  }, [])

  React.useEffect(() => {
    if (tipo === 'receita') setNatureza('outras_receitas')
    else if (tipo === 'despesa') setNatureza('outras_despesas')
  }, [tipo])

  const naturezas = tipo === 'receita' ? NATUREZAS_RECEITA : NATUREZAS_DESPESA

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(v) || v <= 0) {
      toast.error('Informe um valor maior que zero')
      return
    }
    if (!descricao.trim()) {
      toast.error('Informe uma descrição')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/movimentos-financeiros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          tipo,
          natureza,
          valor: v,
          descricao: descricao.trim(),
          centroCustoId: centroCustoId || undefined,
          observacoes: observacoes.trim() || undefined,
        }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`)
      toast.success('Movimento criado')
      router.push('/financeiro/movimentos')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Financeiro"
        title="Novo lançamento"
        subtitle="Receita, despesa ou transferência avulsa."
        search={false}
        showBell={false}
        actions={
          <Link href="/financeiro/movimentos">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />

      <Card className="max-w-2xl p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Data *"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
            />
            <div>
              <label className="block text-small text-fg-2 mb-1.5">Tipo *</label>
              <select
                className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as any)}
              >
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
            <div>
              <label className="block text-small text-fg-2 mb-1.5">Natureza *</label>
              <select
                className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
                value={natureza}
                onChange={(e) => setNatureza(e.target.value)}
              >
                {naturezas.map((n) => (
                  <option key={n} value={n}>{n.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="Valor (R$) *"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
          />

          <Input
            label="Descrição *"
            placeholder="Ex.: Pagamento frete CTR-001"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            required
          />

          <div>
            <label className="block text-small text-fg-2 mb-1.5">
              Centro de custo (opcional)
            </label>
            <select
              className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
              value={centroCustoId}
              onChange={(e) => setCentroCustoId(e.target.value)}
            >
              <option value="">— Nenhum —</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} · {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-small text-fg-2 mb-1.5">
              Observações (opcional)
            </label>
            <textarea
              className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Criar lançamento'}
            </Button>
            <Link href="/financeiro/movimentos">
              <Button variant="ghost" type="button">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </AppShell>
  )
}
