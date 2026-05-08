'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

const GRAO_OPTS = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
  { value: 'sorgo', label: 'Sorgo' },
]
const STATUS_OPTS = [
  { value: 'agendada', label: 'Agendada' },
  { value: 'em_transito', label: 'Em trânsito' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelada', label: 'Cancelada' },
]

const toDateInput = (v: any) => {
  if (!v) return ''
  try {
    return new Date(v).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

export default function EditarOrdemPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { success, error: showError } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(null)
  const [contratos, setContratos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [motoristas, setMotoristas] = useState<any[]>([])
  const [transportadoras, setTransp] = useState<any[]>([])
  const [armazens, setArmazens] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      fetch(`/api/logistica/ordens/${params.id}`).then((r) => r.json()),
      fetch('/api/contratos?limit=200').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/clientes?limit=200').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/logistica/motoristas?ativo=true&limit=200').then((r) => r.json()),
      fetch('/api/fornecedores?tipo=transportadora&ativo=true&limit=200').then((r) => r.json()),
      fetch('/api/logistica/armazens?ativo=true&limit=200').then((r) => r.json()),
    ])
      .then(([ord, c, cli, m, t, a]) => {
        if (ord.error) throw new Error(ord.error)
        setForm({
          ...ord,
          dataAgendada: toDateInput(ord.dataAgendada),
          dataCarregamento: toDateInput(ord.dataCarregamento),
          dataDescarga: toDateInput(ord.dataDescarga),
          ctEdataEmissao: toDateInput(ord.ctEdataEmissao),
        })
        setContratos(c.data || c.contratos || [])
        setClientes(cli.data || [])
        setMotoristas(m.data || [])
        setTransp(t.data || [])
        setArmazens(a.data || [])
      })
      .catch((e) => showError(e.message || 'Erro'))
      .finally(() => setLoading(false))
  }, [params.id])

  const set = (k: string, v: any) => setForm({ ...form, [k]: v })

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const payload: any = {
        contratoId: form.contratoId || null,
        clienteId: form.clienteId || null,
        motoristaId: form.motoristaId || null,
        transportadoraId: form.transportadoraId || null,
        armazemOrigemId: form.armazemOrigemId || null,
        armazemDestinoId: form.armazemDestinoId || null,
        grao: form.grao,
        quantidadeSc: Number(form.quantidadeSc),
        pesoToneladas: form.pesoToneladas ? Number(form.pesoToneladas) : null,
        dataAgendada: form.dataAgendada || null,
        dataCarregamento: form.dataCarregamento || null,
        dataDescarga: form.dataDescarga || null,
        ctEnumero: form.ctEnumero || null,
        ctEpdfUrl: form.ctEpdfUrl || null,
        ctEdataEmissao: form.ctEdataEmissao || null,
        status: form.status,
        observacao: form.observacao || null,
      }
      const r = await fetch(`/api/logistica/ordens/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const j = await r.json()
        throw new Error(j.error || 'Erro')
      }
      success('Ordem atualizada')
      router.push(`/logistica/ordens/${params.id}`)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Card className="text-center py-16 text-fg-3">Carregando…</Card>
      </AppShell>
    )
  }
  if (!form) return null

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Logística · ${form.numero}`}
        title="Editar ordem"
        actions={
          <Link href={`/logistica/ordens/${params.id}`}>
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>Voltar</Button>
          </Link>
        }
      />
      <Card>
        <div className="space-y-8">
          <section className="space-y-4">
            <p className="eyebrow">Contrato e contraparte</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Contrato"
                options={[
                  { value: '', label: '— Sem contrato —' },
                  ...contratos.map((c: any) => ({ value: c.id, label: c.numero })),
                ]}
                value={form.contratoId ?? ''}
                onChange={(e) => set('contratoId', e.target.value)}
              />
              <Select
                label="Cliente"
                options={[
                  { value: '', label: '— Sem cliente —' },
                  ...clientes.map((c: any) => ({ value: c.id, label: c.nome })),
                ]}
                value={form.clienteId ?? ''}
                onChange={(e) => set('clienteId', e.target.value)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Carga</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label="Grão *" options={GRAO_OPTS} value={form.grao} onChange={(e) => set('grao', e.target.value)} />
              <Input
                label="Quantidade (sc) *"
                type="number"
                value={form.quantidadeSc ?? 0}
                onChange={(e) => set('quantidadeSc', e.target.value)}
              />
              <Input
                label="Peso (toneladas)"
                type="number"
                step="0.01"
                value={form.pesoToneladas ?? ''}
                onChange={(e) => set('pesoToneladas', e.target.value)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Origem e destino</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Armazém origem"
                options={[
                  { value: '', label: '— Selecione —' },
                  ...armazens.map((a: any) => ({ value: a.id, label: a.nome })),
                ]}
                value={form.armazemOrigemId ?? ''}
                onChange={(e) => set('armazemOrigemId', e.target.value)}
              />
              <Select
                label="Armazém destino"
                options={[
                  { value: '', label: '— Selecione —' },
                  ...armazens.map((a: any) => ({ value: a.id, label: a.nome })),
                ]}
                value={form.armazemDestinoId ?? ''}
                onChange={(e) => set('armazemDestinoId', e.target.value)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Transporte</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Transportadora"
                options={[
                  { value: '', label: '— Selecione —' },
                  ...transportadoras.map((t: any) => ({ value: t.id, label: t.razaoSocial })),
                ]}
                value={form.transportadoraId ?? ''}
                onChange={(e) => set('transportadoraId', e.target.value)}
              />
              <Select
                label="Motorista"
                options={[
                  { value: '', label: '— Selecione —' },
                  ...motoristas.map((m: any) => ({ value: m.id, label: m.nome })),
                ]}
                value={form.motoristaId ?? ''}
                onChange={(e) => set('motoristaId', e.target.value)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Datas e status</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Data agendada *"
                type="date"
                value={form.dataAgendada ?? ''}
                onChange={(e) => set('dataAgendada', e.target.value)}
              />
              <Input
                label="Data carregamento"
                type="date"
                value={form.dataCarregamento ?? ''}
                onChange={(e) => set('dataCarregamento', e.target.value)}
              />
              <Input
                label="Data descarga"
                type="date"
                value={form.dataDescarga ?? ''}
                onChange={(e) => set('dataDescarga', e.target.value)}
              />
            </div>
            <Select
              label="Status"
              options={STATUS_OPTS}
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            />
          </section>

          <section className="space-y-4">
            <p className="eyebrow">CT-e</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="CT-e número" value={form.ctEnumero ?? ''} onChange={(e) => set('ctEnumero', e.target.value)} />
              <Input
                label="CT-e data emissão"
                type="date"
                value={form.ctEdataEmissao ?? ''}
                onChange={(e) => set('ctEdataEmissao', e.target.value)}
              />
            </div>
            <Input label="CT-e PDF URL" value={form.ctEpdfUrl ?? ''} onChange={(e) => set('ctEpdfUrl', e.target.value)} />
          </section>

          <Input label="Observação" value={form.observacao ?? ''} onChange={(e) => set('observacao', e.target.value)} />

          <div className="flex justify-end gap-3 pt-6 border-t border-border-1">
            <Link href={`/logistica/ordens/${params.id}`}>
              <Button type="button" variant="ghost">Cancelar</Button>
            </Link>
            <Button onClick={handleSave} loading={saving}>Salvar alterações</Button>
          </div>
        </div>
      </Card>
    </AppShell>
  )
}
