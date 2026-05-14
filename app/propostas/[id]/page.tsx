'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Pencil,
  FileDown,
  CheckCircle2,
  XCircle,
  Handshake,
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
import { Cotacao } from '@/components/ui/cotacoes'
import type { Grao as GraoKey } from '@/lib/cotacoes/unidades'

interface GraoItem {
  grao: string
  quantidade?: number
  quantidadeSc?: number  // formato Epic 1 (sacas)
  preco?: number
  precoSc?: number       // formato Epic 1 (R$/saca)
  subtotal?: number
}

function normalizeGrao(g: GraoItem): { grao: string; quantidade: number; preco: number; subtotal: number } {
  const quantidade = Number(g.quantidade ?? g.quantidadeSc ?? 0)
  const preco = Number(g.preco ?? g.precoSc ?? 0)
  const subtotal = Number(g.subtotal ?? quantidade * preco)
  return { grao: g.grao || '—', quantidade, preco, subtotal }
}

interface Proposta {
  id: string
  numero: string
  tipo: 'venda' | 'compra'
  status: 'rascunho' | 'enviada' | 'aceita' | 'rejeitada'
  graos: GraoItem[]
  valorTotal: number
  descricao?: string
  validadeEm: string
  criadaEm: string
  enviadaEm?: string
  cliente: {
    id: string
    nome: string
    email?: string
    telefone?: string
  }
}

const STATUS_TO_BADGE: Record<Proposta['status'], BadgeStatus> = {
  rascunho: 'rascunho',
  enviada: 'em-negociacao',
  aceita: 'assinado',
  rejeitada: 'cancelado',
}

export default function PropostaDetalhesPage() {
  const { id } = useParams()
  const router = useRouter()
  const { status } = useSession()
  const { success, error: showError } = useToast()

  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') fetchProposta()
  }, [status, router])

  const fetchProposta = async () => {
    try {
      const response = await fetch(`/api/propostas/${id}`)
      if (!response.ok) throw new Error('Erro ao buscar proposta')
      const data = await response.json()
      setProposta(data)
    } catch (err) {
      showError('Erro ao carregar proposta')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    if (!proposta) return

    setSaving(true)
    try {
      const response = await fetch(`/api/propostas/${proposta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) throw new Error('Erro ao atualizar status')
      const updated = await response.json()
      setProposta(updated)
      success('Proposta atualizada!')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao atualizar')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!proposta) return

    try {
      const response = await fetch(`/api/propostas/${proposta.id}/pdf`)
      if (!response.ok) throw new Error('Erro ao gerar PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Proposta-${proposta.numero}.pdf`
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
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando proposta…
        </div>
      </AppShell>
    )
  }

  if (!proposta) {
    return (
      <AppShell>
        <Card className="max-w-md mx-auto text-center space-y-4 my-12">
          <p className="eyebrow text-neg">Não encontrada</p>
          <h2 className="text-h2 font-sans tracking-tight text-fg-1">
            Proposta não encontrada
          </h2>
          <Link href="/propostas">
            <Button fullWidth>Voltar para propostas</Button>
          </Link>
        </Card>
      </AppShell>
    )
  }

  const TipoIcon = proposta.tipo === 'venda' ? ArrowUpRight : ArrowDownLeft

  const graoColumns: DenseTableColumn<GraoItem>[] = [
    {
      key: 'grao',
      header: 'Grão',
      accessor: (g) => <span className="text-fg-1 capitalize">{g.grao}</span>,
    },
    {
      key: 'quantidade',
      header: 'Quantidade',
      align: 'right',
      isNumeric: true,
      accessor: (g) => (
        <span className="tabular-nums">
          {normalizeGrao(g).quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
          <span style={{ fontSize: 10, color: 'var(--text-mute)', fontFamily: 'var(--f-mono)', marginLeft: 4 }}>
            t
          </span>
        </span>
      ),
    },
    {
      key: 'preco',
      header: 'Preço',
      align: 'right',
      isNumeric: true,
      accessor: (g) => {
        const { grao, preco } = normalizeGrao(g)
        return (
          <Cotacao
            grao={(grao.toLowerCase() as GraoKey) || 'soja'}
            unidadeEntrada="brlTon"
            valor={preco}
            size="sm"
          />
        )
      },
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      align: 'right',
      isNumeric: true,
      accessor: (g) => (
        <span className="text-fg-1 font-semibold tabular-nums">
          {formatCurrency(normalizeGrao(g).subtotal)}
        </span>
      ),
    },
  ]

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Proposta · #PROP-${proposta.numero}`}
        title={proposta.cliente.nome}
        subtitle={`${proposta.tipo === 'venda' ? 'Venda' : 'Compra'} · Criada em ${formatDate(proposta.criadaEm)}`}
        search={false}
        actions={
          <>
            <Link href="/propostas">
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
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="eyebrow">Status</p>
                <div className="mt-2">
                  <Badge variant={STATUS_TO_BADGE[proposta.status]} />
                </div>
              </div>
              <div className="text-right">
                <p className="eyebrow">Tipo</p>
                <p className="text-fg-1 text-small flex items-center gap-1.5 mt-2">
                  <TipoIcon
                    className={`h-3.5 w-3.5 ${
                      proposta.tipo === 'venda' ? 'text-pos' : 'text-info'
                    }`}
                  />
                  {proposta.tipo === 'venda' ? 'Venda' : 'Compra'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-1">
              <div>
                <p className="eyebrow">Criada em</p>
                <p className="text-fg-1 text-small t-num mt-1">{formatDate(proposta.criadaEm)}</p>
              </div>
              <div>
                <p className="eyebrow">Validade</p>
                <p className="text-fg-1 text-small t-num mt-1">
                  {formatDate(proposta.validadeEm)}
                </p>
              </div>
              {proposta.enviadaEm && (
                <div>
                  <p className="eyebrow">Enviada em</p>
                  <p className="text-fg-1 text-small t-num mt-1">
                    {formatDate(proposta.enviadaEm)}
                  </p>
                </div>
              )}
            </div>

            {proposta.descricao && (
              <div className="pt-4 mt-4 border-t border-border-1">
                <p className="eyebrow">Descrição</p>
                <p className="text-fg-1 text-body mt-2 whitespace-pre-wrap">
                  {proposta.descricao}
                </p>
              </div>
            )}
          </Card>

          <div>
            <p className="eyebrow mb-3">Especificação de grãos</p>
            <DenseTable columns={graoColumns} rows={proposta.graos} rowKey={(g) => g.grao} />
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <p className="eyebrow">Valor total</p>
            <p className="t-num-lg text-accent mt-2">{formatCurrency(proposta.valorTotal)}</p>
            <p className="text-fg-3 text-small mt-1">
              {proposta.graos.length} grão{proposta.graos.length === 1 ? '' : 's'} listado
              {proposta.graos.length === 1 ? '' : 's'}
            </p>
          </Card>

          <Card className="space-y-3">
            <p className="eyebrow">Cliente</p>
            <div>
              <p className="text-fg-1 font-semibold">{proposta.cliente.nome}</p>
              {proposta.cliente.email && (
                <a
                  href={`mailto:${proposta.cliente.email}`}
                  className="text-accent text-small hover:underline flex items-center gap-1.5 mt-1"
                >
                  <Mail className="h-3 w-3" />
                  {proposta.cliente.email}
                </a>
              )}
              {proposta.cliente.telefone && (
                <p className="text-fg-2 text-small t-num mt-1">{proposta.cliente.telefone}</p>
              )}
            </div>
          </Card>

          <Card className="space-y-3">
            <p className="eyebrow">Ações</p>

            {proposta.status === 'rascunho' && (
              <div className="space-y-2">
                <Button
                  fullWidth
                  loading={saving}
                  leftIcon={<Send className="h-4 w-4" />}
                  onClick={() => handleStatusUpdate('enviada')}
                >
                  Enviar proposta
                </Button>
                <Link href={`/propostas/${proposta.id}/editar`}>
                  <Button variant="secondary" fullWidth leftIcon={<Pencil className="h-4 w-4" />}>
                    Editar
                  </Button>
                </Link>
              </div>
            )}

            {proposta.status === 'enviada' && (
              <div className="space-y-2">
                <Button
                  fullWidth
                  loading={saving}
                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => handleStatusUpdate('aceita')}
                >
                  Marcar como aceita
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  loading={saving}
                  leftIcon={<XCircle className="h-4 w-4" />}
                  onClick={() => handleStatusUpdate('rejeitada')}
                  className="text-neg hover:text-neg"
                >
                  Marcar como rejeitada
                </Button>
              </div>
            )}

            {proposta.status === 'aceita' && (
              <Link href={`/contratos/novo?proposIdFk=${proposta.id}`}>
                <Button fullWidth leftIcon={<Handshake className="h-4 w-4" />}>
                  Criar contrato
                </Button>
              </Link>
            )}

            {proposta.status === 'rejeitada' && (
              <p className="text-fg-3 text-small">
                Esta proposta foi rejeitada e está fechada para edição.
              </p>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
