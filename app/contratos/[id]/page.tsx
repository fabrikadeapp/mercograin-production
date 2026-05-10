'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Pencil,
  FileDown,
  CheckCircle2,
  XCircle,
  Wallet,
  Loader2,
  Mail,
} from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Badge,
  type BadgeStatus,
  DenseTable,
  type DenseTableColumn,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'
import { OriginacaoPanel } from './_components/OriginacaoPanel'

interface GraoItem {
  grao: string
  quantidade: number
  preco: number
  subtotal: number
}

interface Contrato {
  id: string
  numero: string
  statusAssinatura: 'pendente' | 'assinado' | 'cancelado'
  modalidade?: string
  dataInicio: string
  dataFim?: string
  assinadoEm?: string
  pdfUrl?: string
  criadoEm: string
  cliente: {
    id: string
    nome: string
    email?: string
    cnpj?: string
  }
  proposta: {
    numero: string
    graos: GraoItem[]
    valorTotal: number
    tipo: 'venda' | 'compra'
  }
}

const STATUS_TO_BADGE: Record<Contrato['statusAssinatura'], BadgeStatus> = {
  pendente: 'pendente',
  assinado: 'assinado',
  cancelado: 'cancelado',
}

export default function ContratoDetalhesPage() {
  const { id } = useParams()
  const router = useRouter()
  const { status } = useSession()
  const { success, error: showError } = useToast()

  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<Array<{ id: string; nome: string; tipo: string; isDefault: boolean }>>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [generatingTpl, setGeneratingTpl] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      fetchContrato()
      fetchTemplates()
    }
  }, [status, router])

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/contratos/templates?ativo=true')
      const data = await res.json()
      const list = (data.templates || []) as Array<{ id: string; nome: string; tipo: string; isDefault: boolean }>
      setTemplates(list)
      const def = list.find((t) => t.isDefault) || list[0]
      if (def) setSelectedTemplateId(def.id)
    } catch (err) {
      console.error('Erro ao carregar templates:', err)
    }
  }

  const handleGenerateFromTemplate = async () => {
    if (!contrato || !selectedTemplateId) {
      showError('Selecione um template')
      return
    }
    setGeneratingTpl(true)
    try {
      const res = await fetch(`/api/contratos/${contrato.id}/render-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao gerar PDF')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Contrato-${contrato.numero}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      success('PDF gerado a partir do template!')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao gerar PDF')
    } finally {
      setGeneratingTpl(false)
    }
  }

  const fetchContrato = async () => {
    try {
      const response = await fetch(`/api/contratos/${id}`)
      if (!response.ok) throw new Error('Erro ao buscar contrato')
      const data = await response.json()
      setContrato(data)
    } catch (err) {
      showError('Erro ao carregar contrato')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    if (!contrato) return

    setSaving(true)
    try {
      const response = await fetch(`/api/contratos/${contrato.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusAssinatura: newStatus }),
      })

      if (!response.ok) throw new Error('Erro ao atualizar status')
      const updated = await response.json()
      setContrato(updated)
      success('Contrato atualizado!')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao atualizar')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!contrato) return

    try {
      const response = await fetch(`/api/contratos/${contrato.id}/pdf`)
      if (!response.ok) throw new Error('Erro ao gerar PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Contrato-${contrato.numero}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      success('PDF baixado com sucesso!')
    } catch (err) {
      showError('Erro ao baixar PDF')
      console.error(err)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-fg-3 text-small gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando contrato…
        </div>
      </AppShell>
    )
  }

  if (!contrato) {
    return (
      <AppShell>
        <Card className="max-w-md mx-auto text-center space-y-4 my-12">
          <p className="eyebrow text-neg">Não encontrado</p>
          <h2 className="text-h2 font-sans tracking-tight text-fg-1">Contrato não encontrado</h2>
          <Link href="/contratos">
            <Button fullWidth>Voltar para contratos</Button>
          </Link>
        </Card>
      </AppShell>
    )
  }

  const TipoIcon = contrato.proposta.tipo === 'venda' ? ArrowUpRight : ArrowDownLeft

  const graoColumns: DenseTableColumn<GraoItem>[] = [
    {
      key: 'grao',
      header: 'Grão',
      accessor: (g) => <span className="text-fg-1 capitalize">{g.grao}</span>,
    },
    {
      key: 'quantidade',
      header: 'Qtd (t)',
      align: 'right',
      isNumeric: true,
      accessor: (g) => g.quantidade.toLocaleString('pt-BR'),
    },
    {
      key: 'preco',
      header: 'Preço (R$/t)',
      align: 'right',
      isNumeric: true,
      accessor: (g) => formatCurrency(g.preco),
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      align: 'right',
      isNumeric: true,
      accessor: (g) => (
        <span className="text-fg-1 font-semibold">{formatCurrency(g.subtotal)}</span>
      ),
    },
  ]

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Contrato · #CTR-${contrato.numero}`}
        title={contrato.cliente.nome}
        subtitle={`Originado da PROP-${contrato.proposta.numero} · Criado em ${formatDate(contrato.criadoEm)}`}
        search={false}
        actions={
          <>
            <Link href="/contratos">
              <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Voltar
              </Button>
            </Link>
            <Button
              variant="secondary"
              leftIcon={<FileDown className="h-4 w-4" />}
              onClick={handleDownloadPDF}
            >
              Exportar PDF
            </Button>
            {templates.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="bg-bg-2 border border-border-1 text-fg-1 text-small rounded-md px-2 py-1.5 focus:outline-none focus:border-accent"
                  aria-label="Template"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                      {t.isDefault ? ' ★' : ''}
                    </option>
                  ))}
                </select>
                <Button
                  leftIcon={<FileDown className="h-4 w-4" />}
                  onClick={handleGenerateFromTemplate}
                  disabled={generatingTpl || !selectedTemplateId}
                >
                  {generatingTpl ? 'Gerando…' : 'Gerar do template'}
                </Button>
              </div>
            )}
          </>
        }
      />

      <OriginacaoPanel
        contratoId={contrato.id}
        modalidade={contrato.modalidade || 'fixo'}
        isAdmin={true}
        qtdContratoSugerida={contrato.proposta.graos.reduce(
          (acc: number, g: any) =>
            acc + Number(g.volumeSc ?? g.quantidadeSc ?? g.quantidade ?? 0),
          0
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="eyebrow">Status assinatura</p>
                <div className="mt-2">
                  <Badge variant={STATUS_TO_BADGE[contrato.statusAssinatura]} />
                </div>
              </div>
              <div className="text-right">
                <p className="eyebrow">Tipo</p>
                <p className="text-fg-1 text-small flex items-center gap-1.5 mt-2">
                  <TipoIcon
                    className={`h-3.5 w-3.5 ${
                      contrato.proposta.tipo === 'venda' ? 'text-pos' : 'text-info'
                    }`}
                  />
                  {contrato.proposta.tipo === 'venda' ? 'Venda' : 'Compra'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-1">
              <div>
                <p className="eyebrow">Início</p>
                <p className="text-fg-1 t-num text-small mt-1">
                  {formatDate(contrato.dataInicio)}
                </p>
              </div>
              {contrato.dataFim && (
                <div>
                  <p className="eyebrow">Fim</p>
                  <p className="text-fg-1 t-num text-small mt-1">{formatDate(contrato.dataFim)}</p>
                </div>
              )}
              {contrato.assinadoEm && (
                <div>
                  <p className="eyebrow">Assinado em</p>
                  <p className="text-pos t-num text-small mt-1">
                    {formatDate(contrato.assinadoEm)}
                  </p>
                </div>
              )}
              <div>
                <p className="eyebrow">Criado em</p>
                <p className="text-fg-2 t-num text-small mt-1">{formatDate(contrato.criadoEm)}</p>
              </div>
            </div>
          </Card>

          <div>
            <p className="eyebrow mb-3">Especificação de grãos</p>
            <DenseTable
              columns={graoColumns}
              rows={contrato.proposta.graos}
              rowKey={(g) => g.grao}
            />
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <p className="eyebrow">Valor total</p>
            <p className="t-num-lg text-accent mt-2">
              {formatCurrency(Number(contrato.proposta.valorTotal))}
            </p>
            <p className="text-fg-3 text-small mt-1">
              {contrato.proposta.graos.length} grão
              {contrato.proposta.graos.length === 1 ? '' : 's'}
            </p>
          </Card>

          <Card className="space-y-3">
            <p className="eyebrow">Cliente</p>
            <div>
              <p className="text-fg-1 font-semibold">{contrato.cliente.nome}</p>
              {contrato.cliente.cnpj && (
                <p className="text-fg-2 font-mono text-small mt-1">{contrato.cliente.cnpj}</p>
              )}
              {contrato.cliente.email && (
                <a
                  href={`mailto:${contrato.cliente.email}`}
                  className="text-accent text-small hover:underline flex items-center gap-1.5 mt-1"
                >
                  <Mail className="h-3 w-3" />
                  {contrato.cliente.email}
                </a>
              )}
            </div>
          </Card>

          <Card className="space-y-3">
            <p className="eyebrow">Ações</p>

            {contrato.statusAssinatura === 'pendente' && (
              <div className="space-y-2">
                <Link href={`/contratos/${contrato.id}/editar`}>
                  <Button variant="secondary" fullWidth leftIcon={<Pencil className="h-4 w-4" />}>
                    Editar
                  </Button>
                </Link>
                <Button
                  fullWidth
                  loading={saving}
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => handleStatusUpdate('assinado')}
                >
                  Marcar como assinado
                </Button>
                <Button
                  variant="ghost"
                  fullWidth
                  loading={saving}
                  leftIcon={<XCircle className="h-4 w-4" />}
                  onClick={() => handleStatusUpdate('cancelado')}
                  className="text-neg hover:text-neg"
                >
                  Cancelar contrato
                </Button>
              </div>
            )}

            {contrato.statusAssinatura === 'assinado' && (
              <Link href={`/boletos/novo?contratoId=${contrato.id}`}>
                <Button fullWidth leftIcon={<Wallet className="h-4 w-4" />}>
                  Criar boleto
                </Button>
              </Link>
            )}

            {contrato.statusAssinatura === 'cancelado' && (
              <p className="text-fg-3 text-small">
                Este contrato foi cancelado e está fechado para edição.
              </p>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
