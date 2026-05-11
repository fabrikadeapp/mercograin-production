import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Filter, Plus, FileText } from 'lucide-react'
import { VgAppShell, VgPageHeader } from '@/components/ui/visionglass'
import { ContratosContent } from '../contratos/_components/ContratosContent'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <VgAppShell>
      <VgPageHeader
        eyebrow="Pipeline · Safra 24/25"
        title="Contratos"
        subtitle="Visão geral dos contratos ativos · negociação em andamento"
        actions={
          <>
            <Link href="/contratos/templates" className="vg-btn vg-btn--secondary">
              <FileText className="w-4 h-4" /> Templates
            </Link>
            <button className="vg-btn vg-btn--secondary">
              <Filter className="w-4 h-4" /> Filtros (3)
            </button>
            <Link href="/contratos/novo" className="vg-btn vg-btn--primary">
              <Plus className="w-4 h-4" /> Novo contrato
            </Link>
          </>
        }
      />
      <ContratosContent />
    </VgAppShell>
  )
}
