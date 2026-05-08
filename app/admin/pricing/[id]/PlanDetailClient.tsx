'use client'
import * as React from 'react'
import { ExternalLink } from 'lucide-react'
import { Card, Tabs } from '@/components/ui/phb'
import type { SerializedPlan } from '@/lib/pricing/serialize'
import { PlanForm, type PlanFormValues } from '../PlanForm'
import { FeaturesEditor } from './FeaturesEditor'

interface SubscriberRow {
  id: string
  status: string
  userEmail: string
  createdAt: string
}

interface Props {
  plan: SerializedPlan
  subscribersCount: number
  subscribers: SubscriberRow[]
}

const TABS = [
  { value: 'general', label: 'Geral' },
  { value: 'features', label: 'Features' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'subscribers', label: 'Assinantes' },
]

function stripeDashboardUrl(productId: string | null): string | null {
  if (!productId) return null
  // Test mode dashboard. Em prod o usuário troca o /test/ manualmente.
  return `https://dashboard.stripe.com/test/products/${productId}`
}

export function PlanDetailClient({
  plan,
  subscribersCount,
  subscribers,
}: Props) {
  const [tab, setTab] = React.useState('general')

  const initialFormValues: Partial<PlanFormValues> = {
    slug: plan.slug,
    name: plan.name,
    tagline: plan.tagline ?? '',
    description: plan.description ?? '',
    badge: plan.badge ?? '',
    highlight: plan.highlight,
    priceCents: plan.priceCents,
    currency: plan.currency,
    billingInterval: plan.billingInterval as PlanFormValues['billingInterval'],
    intervalCount: plan.intervalCount,
    trialDays: plan.trialDays,
    ctaLabel: plan.ctaLabel,
    ctaHref: plan.ctaHref || '',
    sortOrder: plan.sortOrder,
    active: plan.active,
    includedMembers: plan.includedMembers,
    extraMemberPriceCents: plan.extraMemberPriceCents,
  }

  return (
    <div className="space-y-5">
      <div>
        <Tabs
          options={TABS.map((t) => ({
            value: t.value,
            label: t.label,
            count:
              t.value === 'features'
                ? plan.features.length
                : t.value === 'subscribers'
                ? subscribersCount
                : undefined,
          }))}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'general' ? (
        <PlanForm mode="update" planId={plan.id} initial={initialFormValues} />
      ) : null}

      {tab === 'features' ? (
        <FeaturesEditor planId={plan.id} initialFeatures={plan.features} />
      ) : null}

      {tab === 'stripe' ? (
        <Card className="p-5 space-y-4">
          <h3 className="eyebrow">Sincronização Stripe</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-fg-3 text-micro uppercase tracking-wider">
                Stripe product
              </p>
              <p className="text-fg-1 font-mono text-small mt-1 break-all">
                {plan.stripeProductId ?? '— não criado —'}
              </p>
            </div>
            <div>
              <p className="text-fg-3 text-micro uppercase tracking-wider">
                Stripe price (atual)
              </p>
              <p className="text-fg-1 font-mono text-small mt-1 break-all">
                {plan.stripePriceId ?? '— sem price ativo —'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-fg-3 text-micro uppercase tracking-wider mb-2">
              Legacy prices ({plan.legacyPriceIds.length})
            </p>
            {plan.legacyPriceIds.length === 0 ? (
              <p className="text-fg-3 text-small">
                Nenhum preço antigo arquivado.
              </p>
            ) : (
              <ul className="space-y-1">
                {plan.legacyPriceIds.map((id) => (
                  <li
                    key={id}
                    className="font-mono text-micro text-fg-2 break-all"
                  >
                    {id}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {stripeDashboardUrl(plan.stripeProductId) ? (
            <a
              href={stripeDashboardUrl(plan.stripeProductId)!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-accent text-small hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir no Stripe Dashboard
            </a>
          ) : null}

          <div className="rounded-md border border-border-1 bg-bg-2 p-4 text-small text-fg-2">
            <p className="font-medium text-fg-1 mb-1">
              Como a sincronização funciona
            </p>
            <ul className="list-disc list-inside space-y-1 text-fg-3">
              <li>
                Editar nome/descrição/active → atualiza o Product no Stripe.
              </li>
              <li>
                Editar valor → cria um Price NOVO (Stripe não permite editar
                valor) e arquiva o anterior em legacy.
              </li>
              <li>
                Arquivar plano → marca product+price como inactive no Stripe.
              </li>
              <li>
                Assinaturas existentes continuam no preço antigo
                automaticamente.
              </li>
            </ul>
          </div>
        </Card>
      ) : null}

      {tab === 'subscribers' ? (
        <Card className="p-5">
          <div className="mb-3">
            <p className="eyebrow">Assinantes ativos</p>
            <p className="text-h2 font-semibold text-fg-1">
              {subscribersCount}
            </p>
            <p className="text-fg-3 text-small">
              Inclui status: trialing, active e past_due no preço atual ou
              prices legacy.
            </p>
          </div>
          {subscribers.length === 0 ? (
            <p className="text-fg-3 text-small">
              Sem assinantes para exibir.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead className="text-fg-3 text-micro uppercase tracking-wider">
                  <tr className="border-b border-border-1">
                    <th className="text-left py-2 pr-4">E-mail</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-right py-2">Criada em</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-border-1/60 hover:bg-bg-2"
                    >
                      <td className="py-2 pr-4 text-fg-1">{s.userEmail}</td>
                      <td className="py-2 pr-4 text-fg-2 font-mono text-micro uppercase">
                        {s.status}
                      </td>
                      <td className="py-2 text-right text-fg-3">
                        {new Date(s.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  )
}
