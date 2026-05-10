import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { DDSWizard } from '../_components/DDSWizard'

export const dynamic = 'force-dynamic'

export default async function NovaDDSPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const contratos = await db.contrato.findMany({
    where: { ...scope.whereOwn() },
    orderBy: { criadoEm: 'desc' },
    take: 200,
    select: { id: true, numero: true, cliente: { select: { nome: true } } },
  })

  const empresa = await db.dadosEmpresa.findFirst({
    where: { workspaceId: scope.workspaceId },
    select: { razaoSocial: true, cnpj: true, endereco: true, cidade: true, uf: true },
  })

  return (
    <AppShell>
      <PageHeader
        eyebrow="Compliance · EUDR"
        title="Nova Due Diligence Statement"
        subtitle="Wizard guiado conforme Annex II do Regulamento (UE) 2023/1115."
      />
      <DDSWizard
        contratos={contratos.map((c) => ({
          id: c.id,
          label: `${c.numero} — ${c.cliente?.nome ?? ''}`,
        }))}
        operadorDefault={{
          nome: empresa?.razaoSocial || '',
          cnpj: empresa?.cnpj || '',
          endereco: [empresa?.endereco, empresa?.cidade, empresa?.uf].filter(Boolean).join(', '),
        }}
      />
    </AppShell>
  )
}
