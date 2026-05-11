'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AppShell, PageHeader, Card, Button, Input } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

interface CentroCusto {
  id: string
  codigo: string
  nome: string
  paiId: string | null
}

export default function NovoCentroCustoPage() {
  const router = useRouter()
  const toast = useToast()
  const [centros, setCentros] = React.useState<CentroCusto[]>([])
  const [codigo, setCodigo] = React.useState('')
  const [nome, setNome] = React.useState('')
  const [descricao, setDescricao] = React.useState('')
  const [paiId, setPaiId] = React.useState<string>('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/centros-custo')
      .then((r) => r.json())
      .then((j) => setCentros(Array.isArray(j?.data) ? j.data : []))
      .catch(() => setCentros([]))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!codigo.trim() || !nome.trim()) {
      toast.error('Informe código e nome')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/centros-custo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: codigo.trim(),
          nome: nome.trim(),
          descricao: descricao.trim() || undefined,
          paiId: paiId || null,
          ativo: true,
        }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`)
      toast.success('Centro de custo criado')
      router.push('/financeiro/centros-custo')
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
        title="Novo centro de custo"
        subtitle="Adicione um novo nó à árvore de centros — opcionalmente vinculado a um pai."
        search={false}
        showBell={false}
        actions={
          <Link href="/financeiro/centros-custo">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />

      <Card className="max-w-2xl p-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <Input
                label="Código *"
                placeholder="Ex.: 1.01"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label="Nome *"
                placeholder="Ex.: Operação Soja"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-small text-fg-2 mb-1.5">
              Descrição (opcional)
            </label>
            <textarea
              className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
              rows={3}
              placeholder="Detalhe o que esse centro de custo representa."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-small text-fg-2 mb-1.5">
              Centro pai (opcional)
            </label>
            <select
              className="w-full rounded-md border border-border-1 bg-bg-2 px-3 py-2 text-body outline-none focus:ring-2 focus:ring-accent"
              value={paiId}
              onChange={(e) => setPaiId(e.target.value)}
            >
              <option value="">— Nenhum (centro raiz) —</option>
              {centros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} · {c.nome}
                </option>
              ))}
            </select>
            <p className="text-micro text-fg-3 mt-1">
              Use centros pai para criar uma hierarquia (ex.: Operação → Soja → MT).
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Criar centro de custo'}
            </Button>
            <Link href="/financeiro/centros-custo">
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
