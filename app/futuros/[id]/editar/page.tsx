'use client'
import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Input,
  Select,
  Button,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

interface Cliente {
  id: string
  nome: string
}

const GRAOS = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
  { value: 'sorgo', label: 'Sorgo' },
]

const LADOS = [
  { value: 'compra', label: 'Compra' },
  { value: 'venda', label: 'Venda' },
]

const STATUS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'executado', label: 'Executado' },
  { value: 'cancelado', label: 'Cancelado' },
]

export default function EditarFuturoPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const toast = useToast()

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [clientes, setClientes] = React.useState<Cliente[]>([])

  const [grao, setGrao] = React.useState('soja')
  const [lado, setLado] = React.useState('compra')
  const [vencimento, setVencimento] = React.useState('')
  const [precoSc, setPrecoSc] = React.useState('')
  const [volumeSc, setVolumeSc] = React.useState('')
  const [praca, setPraca] = React.useState('')
  const [clienteId, setClienteId] = React.useState('')
  const [observacao, setObservacao] = React.useState('')
  const [status, setStatus] = React.useState('ativo')

  React.useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/futuros/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/clientes?limit=500').then((r) => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([f, c]) => {
        if (!f) {
          toast.error('Contrato não encontrado')
          router.push('/futuros')
          return
        }
        setGrao(f.grao)
        setLado(f.lado)
        setVencimento(f.vencimento?.slice(0, 10) || '')
        setPrecoSc(String(f.precoSc))
        setVolumeSc(String(f.volumeSc))
        setPraca(f.praca || '')
        setClienteId(f.clienteId || '')
        setObservacao(f.observacao || '')
        setStatus(f.status || 'ativo')
        setClientes(Array.isArray(c?.data) ? c.data : Array.isArray(c) ? c : [])
      })
      .finally(() => setLoading(false))
  }, [id, router, toast])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const r = await fetch(`/api/futuros/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grao,
          lado,
          vencimento,
          precoSc: Number(String(precoSc).replace(',', '.')),
          volumeSc: Number(volumeSc),
          praca: praca || null,
          clienteId: clienteId || null,
          observacao: observacao || null,
          status,
        }),
      })
      if (!r.ok) throw new Error()
      toast.success('Contrato atualizado')
      router.push(`/futuros/${id}`)
    } catch {
      toast.error('Falha ao atualizar contrato')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Carregando..." eyebrow="MESA · EDITAR FUTURO" />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader
        title="Editar Contrato Futuro"
        eyebrow="MESA · EDITAR FUTURO"
        actions={
          <Link href={`/futuros/${id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </Link>
        }
      />

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Grão"
              value={grao}
              onChange={(e) => setGrao(e.target.value)}
              options={GRAOS}
            />
            <Select
              label="Lado"
              value={lado}
              onChange={(e) => setLado(e.target.value)}
              options={LADOS}
            />
            <Input
              label="Vencimento"
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              required
            />
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={STATUS}
            />
            <Input
              label="Preço/saca (R$)"
              type="text"
              inputMode="decimal"
              value={precoSc}
              onChange={(e) => setPrecoSc(e.target.value)}
              required
            />
            <Input
              label="Volume (sacas)"
              type="number"
              min={1}
              value={volumeSc}
              onChange={(e) => setVolumeSc(e.target.value)}
              required
            />
            <Input
              label="Praça"
              value={praca}
              onChange={(e) => setPraca(e.target.value)}
              placeholder="Ex: Paranaguá"
            />
            <Select
              label="Cliente (opcional)"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              options={[{ value: '', label: '— Nenhum —' }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
            />
          </div>
          <div>
            <label className="text-fg-3 text-small mb-1 block">Observação</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded bg-bg-2 border border-border-1 text-fg-1 text-small focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-2 pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
            <Link href={`/futuros/${id}`}>
              <Button variant="ghost" type="button">Cancelar</Button>
            </Link>
          </div>
        </form>
      </Card>
    </AppShell>
  )
}
