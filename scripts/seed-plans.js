/**
 * Seed inicial dos planos PHB Grain (Starter / Pro / Enterprise).
 * Idempotente via upsert pelo slug.
 *
 * Uso: DATABASE_URL="..." node scripts/seed-plans.js
 */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

/**
 * Cada item de `features` pode ser:
 *  - string                                  → included:true, emphasis:false
 *  - { label, included?, emphasis? }         → controle fino
 */
const PLANS = [
  {
    slug: 'starter',
    name: 'PHB Grain · Starter',
    tagline: 'Para trading individual',
    description: 'Plano inicial para profissionais autônomos.',
    priceCents: 19700,
    badge: null,
    highlight: false,
    sortOrder: 1,
    trialDays: 10,
    ctaLabel: 'Iniciar trial · Starter',
    ctaHref: '/auth/signup?plan=starter',
    stripeProductId: 'prod_UTiSWTBhCp2ztC',
    stripePriceId: 'price_1TUl1NJmV6kiRaUFqibsOBCS',
    includedMembers: 1,
    extraMemberPriceCents: 15000,
    features: [
      '1 usuário',
      'Até 50 contratos / mês',
      'Cotações CEPEA ao vivo',
      'Relatórios básicos',
      'Suporte por email',
      { label: 'WhatsApp Bot', included: false },
      { label: 'Alertas customizados', included: false },
      { label: 'Multi-empresa', included: false },
      { label: 'API REST', included: false },
      { label: 'White-label', included: false },
      { label: 'Onboarding dedicado', included: false },
      { label: 'SLA 99.9%', included: false },
    ],
  },
  {
    slug: 'pro',
    name: 'PHB Grain · Pro',
    tagline: 'Para mesas com até 5 traders',
    description: 'Plano padrão para mesas de trading.',
    priceCents: 49700,
    badge: 'MAIS POPULAR',
    highlight: true,
    sortOrder: 2,
    trialDays: 10,
    ctaLabel: 'Iniciar trial · Pro',
    ctaHref: '/auth/signup?plan=pro',
    stripeProductId: 'prod_UTiSd3TUlmFQGu',
    stripePriceId: 'price_1TUl1OJmV6kiRaUFdQngRHxO',
    includedMembers: 5,
    extraMemberPriceCents: 15000,
    features: [
      '5 usuários',
      'Contratos ilimitados',
      'Cotações CEPEA ao vivo',
      'WhatsApp Bot',
      'Alertas customizados',
      'Relatórios avançados',
      'Multi-empresa',
      'Suporte prioritário',
      { label: 'API REST', included: false },
      { label: 'White-label', included: false },
      { label: 'Onboarding dedicado', included: false },
      { label: 'SLA 99.9%', included: false },
    ],
  },
  {
    slug: 'enterprise',
    name: 'PHB Grain · Enterprise',
    tagline: 'Para grupos com múltiplas tradings',
    description: 'Plano empresarial com SLA e API REST.',
    priceCents: 149700,
    badge: null,
    highlight: false,
    sortOrder: 3,
    trialDays: 10,
    ctaLabel: 'Falar com vendas',
    ctaHref: '/contato',
    stripeProductId: 'prod_UTiSuq4vTgFqBq',
    stripePriceId: 'price_1TUl1PJmV6kiRaUFbMPhD3EJ',
    includedMembers: 999,
    extraMemberPriceCents: 15000,
    features: [
      'Usuários ilimitados',
      'Contratos ilimitados',
      'Cotações CEPEA ao vivo',
      'WhatsApp Bot',
      'Alertas customizados',
      'Relatórios avançados',
      'Multi-empresa',
      'API REST',
      'White-label',
      'Onboarding dedicado',
      'SLA 99.9%',
      'Suporte 24/7',
    ],
  },
]

function normalizeFeature(raw, idx) {
  if (typeof raw === 'string') {
    return { label: raw, included: true, emphasis: false, sortOrder: idx }
  }
  return {
    label: raw.label,
    included: raw.included !== false,
    emphasis: raw.emphasis === true,
    sortOrder: idx,
  }
}

async function main() {
  console.log('[seed-plans] iniciando…')

  for (const def of PLANS) {
    const { features, ...planData } = def

    const plan = await prisma.plan.upsert({
      where: { slug: planData.slug },
      create: {
        ...planData,
        active: true,
      },
      update: {
        // Não sobrescrevemos preço/Stripe IDs em re-runs (admin pode ter editado)
        name: planData.name,
        tagline: planData.tagline,
        description: planData.description,
        badge: planData.badge,
        highlight: planData.highlight,
        sortOrder: planData.sortOrder,
        trialDays: planData.trialDays,
        ctaLabel: planData.ctaLabel,
        ctaHref: planData.ctaHref,
        includedMembers: planData.includedMembers,
        extraMemberPriceCents: planData.extraMemberPriceCents,
      },
    })

    // Reset features (idempotente do ponto de vista de conteúdo)
    await prisma.planFeature.deleteMany({ where: { planId: plan.id } })
    await prisma.planFeature.createMany({
      data: features.map((f, i) => ({
        planId: plan.id,
        ...normalizeFeature(f, i),
      })),
    })

    console.log(
      `[seed-plans] ✓ ${plan.slug.padEnd(11)} ${plan.name} — R$ ${(
        plan.priceCents / 100
      ).toFixed(2)} (${features.length} features)`
    )
  }

  await prisma.pricingRevision.upsert({
    where: { id: 1 },
    create: { id: 1, revision: 1 },
    update: { revision: { increment: 1 } },
  })

  const rev = await prisma.pricingRevision.findUnique({ where: { id: 1 } })
  console.log(`[seed-plans] revision atual: ${rev?.revision}`)
  console.log('[seed-plans] OK.')
}

main()
  .catch((err) => {
    console.error('[seed-plans] erro:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
