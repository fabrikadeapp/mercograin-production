'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CreditCard, Check, AlertCircle } from 'lucide-react'
import { Button, Card, Brand } from '@/components/ui/phb'

interface Props {
  plan: string
  planLabel: string
  planName: string
  priceFormatted: string
  canceled?: boolean
}

export function CheckoutClient({ plan, planLabel, planName, priceFormatted, canceled }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCheckout = async () => {
    setError('')
    setLoading(true)
    try {
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await r.json()
      if (!r.ok || !data.url) {
        setError(data.error || 'Erro ao iniciar checkout')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch (e) {
      setError('Falha de conexão com Stripe')
      setLoading(false)
    }
  }

  return (
    <>
      <div className="absolute top-8 left-8">
        <Brand />
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <p className="eyebrow">Assinatura · Checkout seguro</p>
          <h1 className="text-h1 font-sans tracking-tight text-fg-1">Confirme seu plano.</h1>
          <p className="text-fg-2 text-body">
            10 dias grátis · cancele quando quiser
          </p>
        </div>

        <Card className="space-y-5">
          {canceled && (
            <div className="flex items-start gap-2 rounded-md border border-l-2 border-border-1 border-l-neg bg-bg-2 p-3 text-small text-fg-1">
              <AlertCircle className="h-4 w-4 text-neg shrink-0 mt-0.5" />
              <span>Checkout cancelado. Você pode tentar novamente abaixo.</span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-l-2 border-border-1 border-l-neg bg-bg-2 p-3 text-small text-fg-1">
              <AlertCircle className="h-4 w-4 text-neg shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-lg border border-border-1 bg-bg-2 p-4 space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="eyebrow">Plano</p>
                <p className="text-fg-1 text-body font-semibold">{planName}</p>
              </div>
              <div className="text-right">
                <p className="eyebrow">Mensal</p>
                <p className="text-fg-1 text-body font-semibold t-num">
                  {priceFormatted}
                </p>
              </div>
            </div>

            <ul className="space-y-1.5 text-small text-fg-2">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-pos shrink-0 mt-0.5" />
                <span>10 dias de teste grátis</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-pos shrink-0 mt-0.5" />
                <span>Cobrança automática mensal após o teste</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-pos shrink-0 mt-0.5" />
                <span>Cancele a qualquer momento sem multa</span>
              </li>
            </ul>
          </div>

          <Button
            type="button"
            fullWidth
            loading={loading}
            onClick={handleCheckout}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {loading ? 'Redirecionando…' : 'Continuar para checkout seguro'}
          </Button>

          <p className="text-fg-3 text-micro text-center">
            Você será redirecionado para o Stripe. Cobramos R$ 0 hoje. Após 10 dias,{' '}
            {priceFormatted} mensalmente.
          </p>
        </Card>

        <p className="text-center text-fg-3 text-small">
          Quer trocar de plano?{' '}
          <Link href="/#planos" className="text-accent hover:underline">
            Ver planos
          </Link>{' '}
          ·{' '}
          <Link
            href={`/assinatura/checkout?plan=${plan === 'starter' ? 'pro' : 'starter'}`}
            className="text-accent hover:underline"
          >
            {plan === 'starter' ? 'Pro' : 'Starter'}
          </Link>
          {plan !== 'enterprise' && (
            <>
              {' '}·{' '}
              <Link
                href="/assinatura/checkout?plan=enterprise"
                className="text-accent hover:underline"
              >
                Enterprise
              </Link>
            </>
          )}
        </p>
      </div>
    </>
  )
}
