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

const CNH_OPTS = [
  { value: '', label: '—' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'E', label: 'E' },
]

export default function EditarMotoristaPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { success, error: showError } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [transportadoras, setTransp] = useState<{ id: string; razaoSocial: string }[]>([])
  const [form, setForm] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/logistica/motoristas/${params.id}`).then((r) => r.json()),
      fetch('/api/fornecedores?tipo=transportadora&ativo=true&limit=100').then((r) => r.json()),
    ])
      .then(([m, t]) => {
        if (m.error) throw new Error(m.error)
        setForm({ ...m })
        setTransp(t.data || [])
      })
      .catch((e) => showError(e.message || 'Erro'))
      .finally(() => setLoading(false))
  }, [params.id])

  const set = (k: string, v: any) => setForm({ ...form, [k]: v })

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        capacidadeSc: form.capacidadeSc ? Number(form.capacidadeSc) : null,
        transportadoraId: form.transportadoraId || null,
        email: form.email || null,
      }
      const r = await fetch(`/api/logistica/motoristas/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const j = await r.json()
        throw new Error(j.error || 'Erro')
      }
      success('Motorista atualizado')
      router.push('/logistica')
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
        eyebrow="Logística · Edição"
        title="Editar motorista"
        subtitle={form.nome}
        actions={
          <Link href="/logistica">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>Voltar</Button>
          </Link>
        }
      />
      <Card>
        <div className="space-y-8">
          <section className="space-y-4">
            <p className="eyebrow">Identificação</p>
            <Input label="Nome *" value={form.nome ?? ''} onChange={(e) => set('nome', e.target.value)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="CPF" value={form.cpf ?? ''} onChange={(e) => set('cpf', e.target.value)} />
              <Input label="CNH" value={form.cnh ?? ''} onChange={(e) => set('cnh', e.target.value)} />
              <Select
                label="Categoria CNH"
                options={CNH_OPTS}
                value={form.cnhCategoria ?? ''}
                onChange={(e) => set('cnhCategoria', e.target.value)}
              />
            </div>
          </section>
          <section className="space-y-4">
            <p className="eyebrow">Contato</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Telefone" value={form.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />
              <Input label="WhatsApp" value={form.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} />
              <Input label="E-mail" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </div>
          </section>
          <section className="space-y-4">
            <p className="eyebrow">Veículo</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Placa" value={form.placa ?? ''} onChange={(e) => set('placa', e.target.value)} />
              <Input label="Veículo" value={form.veiculo ?? ''} onChange={(e) => set('veiculo', e.target.value)} />
              <Input
                label="Capacidade (sc)"
                type="number"
                value={form.capacidadeSc ?? ''}
                onChange={(e) => set('capacidadeSc', e.target.value)}
              />
            </div>
          </section>
          <section className="space-y-4">
            <p className="eyebrow">Vínculo</p>
            <Select
              label="Transportadora"
              options={[
                { value: '', label: '— Selecione —' },
                ...transportadoras.map((t) => ({ value: t.id, label: t.razaoSocial })),
              ]}
              value={form.transportadoraId ?? ''}
              onChange={(e) => set('transportadoraId', e.target.value || null)}
            />
            <Input
              label="Observação"
              value={form.observacao ?? ''}
              onChange={(e) => set('observacao', e.target.value)}
            />
            <Select
              label="Status"
              options={[
                { value: 'true', label: 'Ativo' },
                { value: 'false', label: 'Inativo' },
              ]}
              value={form.ativo ? 'true' : 'false'}
              onChange={(e) => set('ativo', e.target.value === 'true')}
            />
          </section>
          <div className="flex justify-end gap-3 pt-6 border-t border-border-1">
            <Link href="/logistica">
              <Button type="button" variant="ghost">Cancelar</Button>
            </Link>
            <Button onClick={handleSave} loading={saving}>Salvar alterações</Button>
          </div>
        </div>
      </Card>
    </AppShell>
  )
}
