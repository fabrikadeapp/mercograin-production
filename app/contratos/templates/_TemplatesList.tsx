'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Pencil,
  Copy,
  Eye,
  Archive,
  ArchiveRestore,
  Star,
  Loader2,
} from 'lucide-react'
import {
  Card,
  Button,
  Chip,
  DenseTable,
  EmptyState,
  type DenseTableColumn,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

interface Template {
  id: string
  nome: string
  tipo: 'venda' | 'compra' | 'intermediacao' | 'outros'
  descricao: string | null
  ativo: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

const TIPO_LABEL: Record<Template['tipo'], string> = {
  venda: 'Venda',
  compra: 'Compra',
  intermediacao: 'Intermediação',
  outros: 'Outros',
}

export function TemplatesList() {
  const router = useRouter()
  const { success, error: showError } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/contratos/templates')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar')
      setTemplates(data.templates || [])
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao carregar templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDuplicate(t: Template) {
    setBusy(t.id)
    try {
      const detailRes = await fetch(`/api/contratos/templates/${t.id}`)
      const detailData = await detailRes.json()
      if (!detailRes.ok) throw new Error(detailData.error || 'Erro')
      const original = detailData.template
      const res = await fetch('/api/contratos/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: `${original.nome} (cópia)`,
          tipo: original.tipo,
          descricao: original.descricao,
          contentJson: original.contentJson,
          isDefault: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      success('Template duplicado')
      await load()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao duplicar')
    } finally {
      setBusy(null)
    }
  }

  async function handleArchive(t: Template) {
    setBusy(t.id)
    try {
      const res = await fetch(`/api/contratos/templates/${t.id}`, {
        method: t.ativo ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: t.ativo ? undefined : JSON.stringify({ ativo: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      success(t.ativo ? 'Template arquivado' : 'Template reativado')
      await load()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  function handlePreview(t: Template) {
    window.open(`/api/contratos/templates/${t.id}/preview`, '_blank')
  }

  const columns: DenseTableColumn<Template>[] = [
    {
      key: 'nome',
      header: 'Nome',
      accessor: (t) => (
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-fg-3 shrink-0" />
          <div className="min-w-0">
            <div className="text-fg-1 truncate flex items-center gap-1.5">
              {t.nome}
              {t.isDefault && (
                <Star className="h-3 w-3 text-warn fill-warn" aria-label="Padrão" />
              )}
            </div>
            {t.descricao && (
              <div className="text-fg-3 text-micro truncate">{t.descricao}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      accessor: (t) => <Chip variant="neutral">{TIPO_LABEL[t.tipo]}</Chip>,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (t) => (
        <Chip variant={t.ativo ? 'pos' : 'neutral'}>
          {t.ativo ? 'Ativo' : 'Arquivado'}
        </Chip>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Última edição',
      accessor: (t) =>
        new Date(t.updatedAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      accessor: (t) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handlePreview(t)
            }}
            className="p-1.5 rounded hover:bg-bg-3 text-fg-2 hover:text-fg-1"
            title="Preview PDF"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleDuplicate(t)
            }}
            disabled={busy === t.id}
            className="p-1.5 rounded hover:bg-bg-3 text-fg-2 hover:text-fg-1 disabled:opacity-40"
            title="Duplicar"
          >
            {busy === t.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <Link
            href={`/contratos/templates/${t.id}/editar`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded hover:bg-bg-3 text-fg-2 hover:text-fg-1"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleArchive(t)
            }}
            disabled={busy === t.id}
            className="p-1.5 rounded hover:bg-bg-3 text-fg-2 hover:text-fg-1 disabled:opacity-40"
            title={t.ativo ? 'Arquivar' : 'Reativar'}
          >
            {t.ativo ? (
              <Archive className="h-3.5 w-3.5" />
            ) : (
              <ArchiveRestore className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12 text-fg-3 text-small gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando templates…
        </div>
      </Card>
    )
  }

  if (templates.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Nenhum template ainda"
          description="Crie seu primeiro modelo de contrato com variáveis dinâmicas para gerar PDFs profissionais em segundos."
          cta={
            <Link href="/contratos/templates/novo">
              <Button>Criar primeiro template</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <DenseTable
        columns={columns}
        rows={templates}
        rowKey={(t) => t.id}
        onRowClick={(t) => router.push(`/contratos/templates/${t.id}/editar`)}
      />
    </Card>
  )
}
