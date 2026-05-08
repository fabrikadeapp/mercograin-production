import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/phb'
import { db } from '@/lib/db'
import { serializePlan } from '@/lib/pricing/serialize'
import { PlanDetailClient } from './PlanDetailClient'

export const dynamic = 'force-dynamic'

export default async function PlanDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const plan = await db.plan.findUnique({
    where: { id: params.id },
    include: { features: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!plan) return notFound()

  // Subscribers count + top 10
  const priceIds = [plan.stripePriceId, ...plan.legacyPriceIds].filter(
    (x): x is string => !!x
  )
  let subscribersCount = 0
  let subscribers: Array<{
    id: string
    status: string
    userEmail: string
    createdAt: string
  }> = []
  if (priceIds.length > 0) {
    const [count, rows] = await Promise.all([
      db.subscription.count({
        where: {
          stripePriceId: { in: priceIds },
          status: { in: ['trialing', 'active', 'past_due'] },
        },
      }),
      db.subscription.findMany({
        where: { stripePriceId: { in: priceIds } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          workspace: { include: { owner: { select: { email: true } } } },
        },
      }),
    ])
    subscribersCount = count
    subscribers = rows.map((r) => ({
      id: r.id,
      status: r.status,
      userEmail: r.workspace?.owner.email ?? '—',
      createdAt: r.createdAt.toISOString(),
    }))
  }

  const serialized = serializePlan(plan)

  return (
    <>
      <PageHeader
        eyebrow={`ADMIN · PRICING · ${serialized.shortName.toUpperCase()}`}
        title={serialized.name}
        subtitle={serialized.tagline ?? `${serialized.priceFormatted} ${serialized.intervalLabel}`}
        search={false}
        showBell={false}
        actions={
          <Link
            href="/admin/pricing"
            className="inline-flex items-center gap-2 text-fg-2 hover:text-fg-1 text-small"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        }
      />

      <PlanDetailClient
        plan={serialized}
        subscribersCount={subscribersCount}
        subscribers={subscribers}
      />
    </>
  )
}
