import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'
import { AppShell, PageHeader, Button } from '@/components/ui/phb'
import { ContratosContent } from './_components/ContratosContent'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function resumoContratos(): Promise<string> {
  try {
    const scope = await getScope()
    if (!scope) return 'Pipeline de contratos'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereOwn: any = scope.whereOwn()
    // Ativos = não cancelados. Valor vem da proposta vinculada (fonte real).
    const where = { ...whereOwn, statusAssinatura: { not: 'cancelado' } }
    const [ativos, contratos] = await Promise.all([
      db.contrato.count({ where }),
      db.contrato.findMany({ where, select: { proposta: { select: { valorTotal: true } } } }),
    ])
    const total = contratos.reduce((s, c) => s + Number(c.proposta?.valorTotal || 0), 0)
    const totalFmt = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })
    return `${ativos} ativo${ativos === 1 ? '' : 's'} · ${totalFmt} em pipeline`
  } catch {
    return 'Pipeline de contratos'
  }
}

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const subtitle = await resumoContratos()

  return (
    <AppShell>
      <PageHeader
        eyebrow="Pipeline · Comercial"
        title="Contratos"
        subtitle={subtitle}
        actions={
          <>
            <Link href="/contratos/templates">
              <Button variant="ghost" leftIcon={<FileText className="h-4 w-4" />}>
                Templates
              </Button>
            </Link>
            <Link href="/contratos/novo">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Novo contrato</Button>
            </Link>
          </>
        }
      />
      <ContratosContent />
    </AppShell>
  )
}
