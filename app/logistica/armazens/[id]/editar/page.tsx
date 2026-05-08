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

const TIPO_OPTS = [
  { value: 'silo', label: 'Silo' },
  { value: 'granel', label: 'Granel' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'misto', label: 'Misto' },
]

export default function EditarArmazemPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { success, error: showError } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fornecedores, setFornecedores] = useState<{ id: string; razaoSocial: string }[]>([])
  const [form, setForm] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/logistica/armazens/${params.id}`).then((r) => r.json()),
      fetch('/api/fornecedores?tipo=armazem&ativo=true&limit=100').then((r) => r.json()),
    ])
      .then(([armazem, forns]) => {
        if (armazem.error) throw new Error(armazem.error)
        setForm({ ...armazem })
        setFornecedores(forns.data || [])
      })
      .catch((e) => showError(e.message || 'Erro ao carregar'))
      .finally(() => setLoading(false))
  }, [params.id])

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        capacidadeSc: Number(form.capacidadeSc),
        fornecedorId: form.proprio ? null : form.fornecedorId || null,
      }
      const r = await fetch(`/api/logistica/armazens/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const j = await r.json()
        throw new Error(j.error || 'Erro')
      }
      success('Armazém atualizado')
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

  const set = (k: string, v: any) => setForm({ ...form, [k]: v })

  return (
    <AppShell>
      <PageHeader
        eyebrow="Logística · Edição"
        title="Editar armazém"
        subtitle={form.nome}
        actions={
          <Link href="/logistica">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />
      <Card>
        <div className="space-y-8">
          <section className="space-y-4">
            <p className="eyebrow">Identificação</p>
            <Input label="Nome *" value={form.nome ?? ''} onChange={(e) => set('nome', e.target.value)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label="Tipo *" options={TIPO_OPTS} value={form.tipo} onChange={(e) => set('tipo', e.target.value)} />
              <Input
                label="Capacidade (sc)"
                type="number"
                value={form.capacidadeSc ?? 0}
                onChange={(e) => set('capacidadeSc', e.target.value)}
              />
              <Select
                label="Modalidade"
                options={[
                  { value: 'true', label: 'Próprio' },
                  { value: 'false', label: 'Terceirizado' },
                ]}
                value={form.proprio ? 'true' : 'false'}
                onChange={(e) => set('proprio', e.target.value === 'true')}
              />
            </div>
            {!form.proprio && (
              <Select
                label="Fornecedor"
                options={[
                  { value: '', label: '— Selecione —' },
                  ...fornecedores.map((f) => ({ value: f.id, label: f.razaoSocial })),
                ]}
                value={form.fornecedorId ?? ''}
                onChange={(e) => set('fornecedorId', e.target.value || null)}
              />
            )}
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Localização</p>
            <Input label="Endereço" value={form.endereco ?? ''} onChange={(e) => set('endereco', e.target.value)} />
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Input label="Cidade" value={form.cidade ?? ''} onChange={(e) => set('cidade', e.target.value)} />
              </div>
              <Input label="UF" maxLength={2} value={form.uf ?? ''} onChange={(e) => set('uf', e.target.value)} />
            </div>
            <Input label="CEP" value={form.cep ?? ''} onChange={(e) => set('cep', e.target.value)} />
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Contato</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Contato" value={form.contato ?? ''} onChange={(e) => set('contato', e.target.value)} />
              <Input label="Telefone" value={form.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />
            </div>
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
            <Button onClick={handleSave} loading={saving}>
              Salvar alterações
            </Button>
          </div>
        </div>
      </Card>
    </AppShell>
  )
}
