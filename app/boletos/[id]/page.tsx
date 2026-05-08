'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Mail,
  Loader2,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { AppShell, PageHeader, Card, Button, Chip } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'

interface Boleto {
  id: string
  numero: string
  valor: string
  vencimento: string
  status: 'aberto' | 'pago' | 'vencido' | 'cancelado'
  banco: string
  linkBoleto?: string
  braspagId?: string
  confirmadoEm?: string
  criadoEm: string
  cliente: {
    id: string
    nome: string
    cnpj?: string
    email?: string
  }
  contrato?: {
    id: string
    numero: string
  }
}

const STATUS_VARIANT: Record<Boleto['status'], 'pos' | 'warn' | 'neg' | 'neutral'> = {
  pago: 'pos',
  aberto: 'warn',
  vencido: 'neg',
  cancelado: 'neutral',
}
const STATUS_LABEL: Record<Boleto['status'], string> = {
  pago: 'Pago',
  aberto: 'Aberto',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
}

export default function DetalheBoletoPage() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const { success, error: showError, info } = useToast()

  const [boleto, setBoleto] = useState<Boleto | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const boletoId = params.id as string

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') fetchBoleto()
  }, [status, boletoId, router])

  const fetchBoleto = async () => {
    try {
      const response = await fetch(`/api/boletos/${boletoId}`)
      if (!response.ok) throw new Error('Boleto não encontrado')
      const data = await response.json()
      setBoleto(data)
    } catch (err) {
      showError('Erro ao carregar boleto')
      console.error(err)
      router.push('/boletos')
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshStatus = async () => {
    if (!boleto?.braspagId) {
      info('Boleto ainda não foi registrado no Braspag')
      return
    }

    setRefreshing(true)
    try {
      const response = await fetch(`/api/boletos/${boletoId}/refresh-status`, {
        method: 'PATCH',
      })

      if (!response.ok) throw new Error('Erro ao atualizar status')

      const updatedBoleto = await response.json()
      setBoleto(updatedBoleto)
      success('Status atualizado com sucesso!')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao atualizar status')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-fg-3 text-small gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando boleto…
        </div>
      </AppShell>
    )
  }

  if (!boleto) {
    return (
      <AppShell>
        <Card className="max-w-md mx-auto text-center space-y-4 my-12">
          <p className="eyebrow text-neg">Não encontrado</p>
          <h2 className="text-h2 font-sans tracking-tight text-fg-1">Boleto não encontrado</h2>
          <Link href="/boletos">
            <Button fullWidth>Voltar para boletos</Button>
          </Link>
        </Card>
      </AppShell>
    )
  }

  const valorDecimal = parseFloat(boleto.valor)

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Boleto · BOL-${boleto.numero}`}
        title={boleto.cliente.nome}
        subtitle={`Banco ${boleto.banco} · Vencimento ${formatDate(boleto.vencimento)}`}
        search={false}
        actions={
          <>
            <Link href="/boletos">
              <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Voltar
              </Button>
            </Link>
            {boleto.linkBoleto && (
              <a
                href={boleto.linkBoleto}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button leftIcon={<ExternalLink className="h-4 w-4" />}>Abrir boleto</Button>
              </a>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">Valor cobrado</p>
                <p className="t-num-lg text-accent mt-2">{formatCurrency(valorDecimal)}</p>
              </div>
              <Chip variant={STATUS_VARIANT[boleto.status]}>{STATUS_LABEL[boleto.status]}</Chip>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 mt-4 border-t border-border-1">
              <div>
                <p className="eyebrow">Número</p>
                <p className="text-fg-1 t-num text-small mt-1">{boleto.numero}</p>
              </div>
              <div>
                <p className="eyebrow">Banco</p>
                <p className="text-fg-1 text-small mt-1">{boleto.banco}</p>
              </div>
              <div>
                <p className="eyebrow">Vencimento</p>
                <p className="text-fg-1 t-num text-small mt-1">
                  {formatDate(boleto.vencimento)}
                </p>
              </div>
              <div>
                <p className="eyebrow">Criado em</p>
                <p className="text-fg-2 t-num text-small mt-1">{formatDate(boleto.criadoEm)}</p>
              </div>
              {boleto.confirmadoEm && (
                <div>
                  <p className="eyebrow">Pago em</p>
                  <p className="text-pos t-num text-small mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {formatDate(boleto.confirmadoEm)}
                  </p>
                </div>
              )}
              {boleto.braspagId && (
                <div>
                  <p className="eyebrow">ID Braspag</p>
                  <p className="text-fg-3 font-mono text-small mt-1 truncate">
                    {boleto.braspagId}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <p className="eyebrow mb-4">Link do boleto</p>
            {boleto.linkBoleto ? (
              <div className="flex items-center justify-between gap-4 p-4 rounded-md bg-bg-2 border border-l-2 border-border-1 border-l-pos">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-pos shrink-0 mt-0.5" />
                  <div>
                    <p className="text-fg-1 font-semibold text-small">Boleto disponível</p>
                    <p className="text-fg-3 text-small">Clique para baixar ou imprimir.</p>
                  </div>
                </div>
                <a href={boleto.linkBoleto} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" leftIcon={<ExternalLink className="h-3.5 w-3.5" />}>
                    Abrir
                  </Button>
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-md bg-bg-2 border border-l-2 border-border-1 border-l-warn">
                <Clock className="h-5 w-5 text-warn shrink-0" />
                <div>
                  <p className="text-fg-1 font-semibold text-small">Boleto pendente</p>
                  <p className="text-fg-3 text-small">
                    O link será gerado em alguns instantes.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-3">
            <p className="eyebrow">Cliente</p>
            <div>
              <p className="text-fg-1 font-semibold">{boleto.cliente.nome}</p>
              {boleto.cliente.cnpj && (
                <p className="text-fg-2 font-mono text-small mt-1">{boleto.cliente.cnpj}</p>
              )}
              {boleto.cliente.email && (
                <a
                  href={`mailto:${boleto.cliente.email}`}
                  className="text-accent text-small hover:underline flex items-center gap-1.5 mt-1"
                >
                  <Mail className="h-3 w-3" />
                  {boleto.cliente.email}
                </a>
              )}
            </div>
            {boleto.contrato && (
              <div className="pt-3 border-t border-border-1">
                <p className="eyebrow">Contrato de origem</p>
                <Link
                  href={`/contratos/${boleto.contrato.id}`}
                  className="text-accent text-small hover:underline t-num block mt-1"
                >
                  CTR-{boleto.contrato.numero}
                </Link>
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <p className="eyebrow">Ações</p>
            <Button
              variant="secondary"
              fullWidth
              leftIcon={<RefreshCw className="h-4 w-4" />}
              loading={refreshing}
              disabled={refreshing || !boleto.braspagId}
              onClick={handleRefreshStatus}
            >
              {refreshing ? 'Atualizando…' : 'Atualizar status'}
            </Button>
            <p className="text-fg-3 text-small">
              O status é atualizado automaticamente via webhook quando o boleto é pago. Esta ação
              força uma checagem manual no Braspag.
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
