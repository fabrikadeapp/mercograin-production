import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { MarcaForm } from './_components/MarcaForm'

export const dynamic = 'force-dynamic'

export default async function MarcaPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const empresa = await db.dadosEmpresa.findUnique({
    where: { workspaceId: scope.workspaceId },
    select: { logoUrl: true, logoUploadedAt: true },
  })

  const canEdit =
    scope.isAdmin ||
    scope.workspaceRole === 'owner' ||
    scope.workspaceRole === 'admin'

  return (
    <AppShell>
      <PageHeader
        eyebrow="Configurações"
        title="Marca & Logo"
        subtitle="A logo aparecerá em todos os PDFs gerados por este workspace (contratos, propostas, boletos)."
        search={false}
      />
      <MarcaForm
        initialLogoUrl={empresa?.logoUrl ?? null}
        initialUploadedAt={empresa?.logoUploadedAt?.toISOString() ?? null}
        canEdit={canEdit}
      />
    </AppShell>
  )
}
