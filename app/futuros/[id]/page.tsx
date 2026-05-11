'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  KPICard,
  GrainBadge,
  Chip,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

interface Futuro {
  id: string
  grao: string
  lado: 'compra' | 'venda'
  vencimento: string
  precoSc: number
  volumeSc: number
  codigoVenc?: string | null
  praca?: string | null
  observacao?: string | null
  status: 'ativo' | 'executado' | 'cancelado'
  clienteId?: string | null
  cliente?: { nome: string } | null
  criadoEm: string
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export default function FuturoDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const toast = useToast()
  const [futuro, setFuturo] = useState<Futuro | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/futuros/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setFuturo(data))
      .catch(() => toast.error('Contrato futuro não encontrado'))
      .finally(() => setLoading(false))
  }, [id, toast])

  async function handleDelete() {
    if (!confirm('Cancelar este contrato futuro?')) return
    setDeleting(true)
    try {
      const r = await fetch(`/api/futuros/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      toast.success('Contrato cancelado')
      router.push('/futuros')
    } catch {
      toast.error('Falha ao cancelar')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Carregando..." eyebrow="MESA · CONTRATO FUTURO" />
      </AppShell>
    )
  }

  if (!futuro) {
    return (
      <AppShell>
        <PageHeader
          title="Contrato não encontrado"
          eyebrow="MESA · CONTRATO FUTURO"
          actions={
            <Link href="/futuros">
              <Button variant="ghost"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
            </Link>
          }
        />
      </AppShell>
    )
  }

  const valorTotal = futuro.precoSc * futuro.volumeSc
  const statusVariant = futuro.status === 'ativo' ? 'pos' : futuro.status === 'cancelado' ? 'neg' : 'info'

  return (
    <AppShell>
      <PageHeader
        title={`${futuro.grao.toUpperCase()} ${futuro.lado === 'compra' ? 'Compra' : 'Venda'} · ${futuro.codigoVenc || fmtDate(futuro.vencimento)}`}
        eyebrow="MESA · CONTRATO FUTURO"
        subtitle={`Criado em ${fmtDate(futuro.criadoEm)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/futuros">
              <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
            </Link>
            <Link href={`/futuros/${id}/editar`}>
              <Button variant="secondary" size="sm"><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
            </Link>
            {futuro.status === 'ativo' && (
              <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-1" /> {deleting ? 'Cancelando...' : 'Cancelar'}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          eyebrow="Status"
          value={futuro.status.toUpperCase()}
        />
        <KPICard eyebrow="Preço por saca" value={fmtBRL(futuro.precoSc)} />
        <KPICard eyebrow="Volume" value={`${futuro.volumeSc.toLocaleString('pt-BR')} sc`} />
        <KPICard eyebrow="Total" value={fmtBRL(valorTotal)} />
      </div>

      <Card className="p-6 space-y-4">
        <h3 className="eyebrow text-fg-3">Detalhes da operação</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-small">
          <div className="space-y-1">
            <p className="text-fg-3">Grão</p>
            <div className="flex items-center gap-2">
              <GrainBadge variant={futuro.grao as any} />
              <span className="text-fg-1 capitalize">{futuro.grao}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-fg-3">Lado</p>
            <Chip variant={futuro.lado === 'compra' ? 'pos' : 'neg'}>
              {futuro.lado === 'compra' ? 'COMPRA' : 'VENDA'}
            </Chip>
          </div>
          <div className="space-y-1">
            <p className="text-fg-3">Vencimento</p>
            <p className="text-fg-1">{fmtDate(futuro.vencimento)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-fg-3">Código vencimento</p>
            <p className="text-fg-1 t-num">{futuro.codigoVenc || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-fg-3">Praça</p>
            <p className="text-fg-1">{futuro.praca || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-fg-3">Cliente</p>
            <p className="text-fg-1">{futuro.cliente?.nome || '—'}</p>
          </div>
          {futuro.observacao && (
            <div className="md:col-span-2 space-y-1">
              <p className="text-fg-3">Observação</p>
              <p className="text-fg-1 whitespace-pre-wrap">{futuro.observacao}</p>
            </div>
          )}
        </div>
      </Card>
    </AppShell>
  )
}
