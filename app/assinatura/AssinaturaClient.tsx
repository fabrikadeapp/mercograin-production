'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CreditCard, RefreshCw, XCircle, AlertCircle } from 'lucide-react'
import { Button, Card, Brand, Chip } from '@/components/ui/phb'

interface SubInfo {
  plan: string
  planLabel: string
  priceFormatted: string
  status: string
  trialEnd: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

interface Props {
  success?: boolean
  subscription: SubInfo | null
}

type ChipTone = 'pos' | 'warn' | 'neg' | 'neutral'
const STATUS_LABEL: Record<string, { label: string; tone: ChipTone }> = {
  trialing: { label: 'Em teste (trial)', tone: 'pos' },
  active: { label: 'Ativa', tone: 'pos' },
  past_due: { label: 'Pagamento atrasado', tone: 'warn' },
  canceled: { label: 'Cancelada', tone: 'neg' },
  incomplete: { label: 'Incompleta', tone: 'warn' },
  incomplete_expired: { label: 'Expirada', tone: 'neg' },
  unpaid: { label: 'Não paga', tone: 'neg' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function AssinaturaClient({ success, subscription }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'portal' | 'cancel' | null>(null)
  const [error, setError] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => router.push('/dashboard'), 2500)
      return () => clearTimeout(t)
    }
  }, [success, router])

  const openPortal = async () => {
    setError('')
    setLoading('portal')
    try {
      const r = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await r.json()
      if (!r.ok || !data.url) {
        setError(data.error || 'Erro ao abrir portal')
        setLoading(null)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Falha de conexão')
      setLoading(null)
    }
  }

  const cancelSub = async () => {
    setError('')
    setLoading('cancel')
    try {
      const r = await fetch('/api/stripe/cancel', { method: 'POST' })
      const data = await r.json()
      if (!r.ok) {
        setError(data.error || 'Erro ao cancelar')
        setLoading(null)
        return
      }
      setCancelOpen(false)
      setLoading(null)
      router.refresh()
    } catch {
      setError('Falha de conexão')
      setLoading(null)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-bg-0 flex items-center justify-center p-6">
        <div className="absolute top-8 left-8">
          <Brand />
        </div>
        <Card className="max-w-md text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="h-12 w-12 text-pos" />
          </div>
          <h1 className="text-h2 text-fg-1">Assinatura criada!</h1>
          <p className="text-fg-2 text-body">
            Acessando seu painel em instantes…
          </p>
        </Card>
      </div>
    )
  }

  const status = subscription?.status
  const statusInfo = status ? STATUS_LABEL[status] : null

  return (
    <div className="min-h-screen bg-bg-0 p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Brand />
          <Link href="/dashboard" className="text-fg-3 text-small hover:text-accent">
            ← Dashboard
          </Link>
        </div>

        <div className="space-y-2">
          <p className="eyebrow">Conta · Assinatura</p>
          <h1 className="text-h1 font-sans tracking-tight text-fg-1">Sua assinatura</h1>
          <p className="text-fg-2 text-body">
            Gerencie seu plano, método de pagamento e status de cobrança.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-l-2 border-border-1 border-l-neg bg-bg-2 p-3 text-small text-fg-1">
            <AlertCircle className="h-4 w-4 text-neg shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!subscription ? (
          <Card className="space-y-4">
            <h2 className="text-h3 text-fg-1">Sem assinatura ativa</h2>
            <p className="text-fg-2 text-body">
              Você ainda não possui uma assinatura. Escolha um plano para começar.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={() => router.push('/assinatura/checkout?plan=starter')}>
                Assinar Starter
              </Button>
              <Button onClick={() => router.push('/assinatura/checkout?plan=pro')}>
                Assinar Pro
              </Button>
              <Button onClick={() => router.push('/assinatura/checkout?plan=enterprise')}>
                Assinar Enterprise
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="eyebrow">Plano atual</p>
                  <p className="text-h3 text-fg-1">{subscription.planLabel}</p>
                  <p className="text-fg-2 text-body t-num">{subscription.priceFormatted} / mês</p>
                </div>
                {statusInfo && (
                  <Chip variant={statusInfo.tone}>{statusInfo.label}</Chip>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border-1">
                {subscription.status === 'trialing' && subscription.trialEnd && (
                  <div>
                    <p className="eyebrow">Fim do teste grátis</p>
                    <p className="text-fg-1 text-body t-num">
                      {formatDate(subscription.trialEnd)}
                    </p>
                  </div>
                )}
                {subscription.currentPeriodEnd && (
                  <div>
                    <p className="eyebrow">
                      {subscription.cancelAtPeriodEnd
                        ? 'Cancela em'
                        : 'Próxima cobrança'}
                    </p>
                    <p className="text-fg-1 text-body t-num">
                      {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  </div>
                )}
              </div>

              {subscription.cancelAtPeriodEnd && (
                <div className="rounded-md border border-l-2 border-border-1 bg-bg-2 p-3 text-small text-fg-1" style={{ borderLeftColor: 'var(--warn)' }}>
                  Sua assinatura será cancelada ao fim do período em{' '}
                  {formatDate(subscription.currentPeriodEnd)}.
                </div>
              )}
            </Card>

            <Card className="space-y-3">
              <h2 className="text-h3 text-fg-1">Ações</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="secondary"
                  onClick={() => router.push('/assinatura/checkout?plan=pro')}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Trocar plano
                </Button>
                <Button variant="secondary" loading={loading === 'portal'} onClick={openPortal}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Gerenciar pagamento
                </Button>
                {!subscription.cancelAtPeriodEnd && subscription.status !== 'canceled' && (
                  <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar assinatura
                  </Button>
                )}
              </div>
            </Card>
          </>
        )}

        {cancelOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <Card className="max-w-md space-y-4">
              <h2 className="text-h3 text-fg-1">Confirmar cancelamento</h2>
              <p className="text-fg-2 text-body">
                Sua assinatura permanecerá ativa até o fim do período em{' '}
                <strong>{formatDate(subscription?.currentPeriodEnd ?? null)}</strong>. Após
                isso, você perderá o acesso ao painel.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCancelOpen(false)}>
                  Voltar
                </Button>
                <Button loading={loading === 'cancel'} onClick={cancelSub}>
                  Confirmar cancelamento
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
