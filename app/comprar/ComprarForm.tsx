'use client'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Input, Card } from '@/components/ui/phb'
import type { SerializedPlan } from '@/lib/pricing/serialize'

interface Props {
  plans: SerializedPlan[]
  initialPlan: string
}

function maskCnpj(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function ComprarForm({ plans, initialPlan }: Props) {
  const [plan, setPlan] = useState(initialPlan)
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!plan) {
      setError('Selecione um plano')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('E-mail inválido')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout-publico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, email: email.trim().toLowerCase(), nome, cnpj }),
      })
      const j = await res.json()
      if (!res.ok) {
        if (res.status === 409 && j.loginUrl) {
          setError(j.error)
          return
        }
        throw new Error(j.error || 'Erro ao iniciar checkout')
      }
      if (j.url) {
        window.location.href = j.url
        return
      }
      throw new Error('Resposta inválida do servidor')
    } catch (err: any) {
      setError(err.message || 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6 md:p-8">
      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <div className="eyebrow text-fg-3 mb-3">PLANO</div>
          <div className="grid gap-3">
            {plans.map((p) => {
              const checked = plan === p.slug
              return (
                <label
                  key={p.id}
                  className={
                    'flex items-start gap-3 cursor-pointer rounded-md border p-4 transition-colors ' +
                    (checked
                      ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                      : 'border-border-1 hover:border-border-2 bg-bg-1')
                  }
                >
                  <input
                    type="radio"
                    name="plan"
                    value={p.slug}
                    checked={checked}
                    onChange={() => setPlan(p.slug)}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-fg-1 font-semibold">{p.name}</div>
                        {p.tagline && (
                          <div className="text-fg-3 text-small">{p.tagline}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-fg-1 font-semibold">
                          {p.priceFormatted}
                          <span className="text-fg-3 text-small font-normal">
                            /{p.intervalLabel}
                          </span>
                        </div>
                        {p.trialDays > 0 && (
                          <div className="text-fg-3 text-micro">
                            {p.trialDays} dias grátis
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="E-mail *"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="voce@empresa.com.br"
            containerClassName="sm:col-span-2"
            helperText="Enviaremos o código da licença e o link de ativação."
          />
          <Input
            label="Nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como devemos te chamar"
          />
          <Input
            label="CNPJ (opcional)"
            value={cnpj}
            onChange={(e) => setCnpj(maskCnpj(e.target.value))}
            placeholder="00.000.000/0000-00"
          />
        </div>

        {error && (
          <div className="rounded-md border border-neg/30 bg-neg/10 p-3 text-small text-neg">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-micro text-fg-3">
            Você será redirecionado ao Stripe para concluir o pagamento com
            segurança. Cancele quando quiser.
          </p>
          <Button type="submit" size="lg" loading={loading} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando…
              </>
            ) : (
              'Ir para o pagamento'
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}
