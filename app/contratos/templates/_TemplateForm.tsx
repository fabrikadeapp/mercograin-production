'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Eye } from 'lucide-react'
import {
  Card,
  Button,
  Input,
  Select,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { TemplateEditor } from '@/components/contratos/TemplateEditor'

export interface TemplateFormInitial {
  id?: string
  nome?: string
  tipo?: 'venda' | 'compra' | 'intermediacao' | 'outros'
  descricao?: string | null
  contentJson?: any
  isDefault?: boolean
}

interface Props {
  initial?: TemplateFormInitial
  mode: 'create' | 'edit'
}

export function TemplateForm({ initial, mode }: Props) {
  const router = useRouter()
  const { success, error: showError } = useToast()

  const [nome, setNome] = React.useState(initial?.nome ?? '')
  const [tipo, setTipo] = React.useState<TemplateFormInitial['tipo']>(initial?.tipo ?? 'venda')
  const [descricao, setDescricao] = React.useState(initial?.descricao ?? '')
  const [isDefault, setIsDefault] = React.useState(!!initial?.isDefault)
  const [contentJson, setContentJson] = React.useState<any>(initial?.contentJson ?? null)
  const [saving, setSaving] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      showError('Informe um nome')
      return
    }
    setSaving(true)
    try {
      const url =
        mode === 'create'
          ? '/api/contratos/templates'
          : `/api/contratos/templates/${initial!.id}`
      const method = mode === 'create' ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          tipo,
          descricao: descricao || null,
          contentJson,
          isDefault,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      success(mode === 'create' ? 'Template criado' : 'Template atualizado')
      router.push('/contratos/templates')
      router.refresh()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function handlePreview() {
    if (mode !== 'edit' || !initial?.id) {
      showError('Salve o template antes de visualizar o PDF')
      return
    }
    window.open(`/api/contratos/templates/${initial.id}/preview`, '_blank')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/contratos/templates">
          <Button type="button" variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Voltar
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {mode === 'edit' && (
            <Button
              type="button"
              variant="secondary"
              leftIcon={<Eye className="h-4 w-4" />}
              onClick={handlePreview}
            >
              Preview PDF
            </Button>
          )}
          <Button
            type="submit"
            disabled={saving}
            leftIcon={
              saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />
            }
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="eyebrow block mb-1.5">Nome</label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Contrato padrão de venda — Soja"
              required
            />
          </div>
          <div>
            <label className="eyebrow block mb-1.5">Tipo</label>
            <Select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as any)}
              options={[
                { value: 'venda', label: 'Venda' },
                { value: 'compra', label: 'Compra' },
                { value: 'intermediacao', label: 'Intermediação' },
                { value: 'outros', label: 'Outros' },
              ]}
            />
          </div>
          <div className="md:col-span-3">
            <label className="eyebrow block mb-1.5">Descrição (opcional)</label>
            <Input
              value={descricao || ''}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Para que serve este template?"
            />
          </div>
          <div className="md:col-span-3">
            <label className="flex items-center gap-2 text-small text-fg-1 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded"
              />
              Definir como template padrão para contratos do tipo &quot;{tipo}&quot;
            </label>
          </div>
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-h3 text-fg-1 font-medium">Conteúdo do template</h3>
          <span className="text-fg-3 text-micro">
            Use o botão <span className="text-accent">@</span> para inserir variáveis dinâmicas
          </span>
        </div>
        <TemplateEditor initialContent={initial?.contentJson} onChange={setContentJson} />
      </div>
    </form>
  )
}
