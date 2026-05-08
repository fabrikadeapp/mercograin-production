import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader, Button, Card } from '@/components/ui/phb'
import { loadAllPlans } from '@/lib/pricing/serialize'
import { db } from '@/lib/db'
import { PlansList } from './PlansList'

export const dynamic = 'force-dynamic'

export default async function AdminPricingPage() {
  const [plans, rev] = await Promise.all([
    loadAllPlans(),
    db.pricingRevision.findUnique({ where: { id: 1 } }),
  ])

  const activeCount = plans.filter((p) => p.active).length
  const inactiveCount = plans.length - activeCount

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · PRICING"
        title="Gestão de planos"
        subtitle="Edite preços, features e CTAs. As mudanças sincronizam com o Stripe e refletem em /, /precos e checkout."
        search={false}
        showBell={false}
        actions={
          <Link href="/admin/pricing/novo">
            <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
              Novo plano
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <p className="eyebrow">Total de planos</p>
          <p className="text-h2 font-semibold text-fg-1 mt-1">{plans.length}</p>
        </Card>
        <Card className="p-4">
          <p className="eyebrow">Ativos</p>
          <p className="text-h2 font-semibold text-pos mt-1">{activeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="eyebrow">Inativos</p>
          <p className="text-h2 font-semibold text-fg-3 mt-1">{inactiveCount}</p>
        </Card>
        <Card className="p-4">
          <p className="eyebrow">Revision</p>
          <p className="text-h2 font-semibold text-accent mt-1 font-mono">
            v{rev?.revision ?? 1}
          </p>
        </Card>
      </div>

      <p className="text-fg-3 text-small mb-3">
        Arraste os cards para reordenar. A ordem definida aparece em /, /precos e
        no checkout.
      </p>

      <PlansList initialPlans={plans} />
    </>
  )
}
