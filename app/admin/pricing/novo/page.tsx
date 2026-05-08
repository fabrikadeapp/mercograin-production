import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui/phb'
import { PlanForm } from '../PlanForm'

export const dynamic = 'force-dynamic'

export default function NovoPlanoPage() {
  return (
    <>
      <PageHeader
        eyebrow="ADMIN · PRICING · NOVO"
        title="Novo plano"
        subtitle="Cria um novo plano no banco e sincroniza um Stripe Product + Price."
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
      <div className="max-w-3xl">
        <PlanForm mode="create" />
      </div>
    </>
  )
}
