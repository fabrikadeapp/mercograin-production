import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { requireScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { normalizeDesignSystem } from '@/lib/ui/design-systems'
import { TemaForm } from './_components/TemaForm'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Aparência & Tema' }

export default async function TemaPage() {
  let scope
  try {
    scope = await requireScope()
  } catch {
    redirect('/auth/login')
  }

  const canEdit =
    scope.isAdmin ||
    scope.workspaceRole === 'owner' ||
    scope.workspaceRole === 'admin'

  const ws = await db.workspace.findUnique({
    where: { id: scope.workspaceId },
    select: { designSystem: true },
  })
  const current = normalizeDesignSystem(ws?.designSystem)

  return (
    <AppShell>
      <PageHeader
        eyebrow="Configurações · Aparência"
        title="Tema da corretora"
        subtitle="Escolha o design system que melhor representa sua marca. O tema vale para todos os usuários da sua corretora."
      />
      <TemaForm current={current} canEdit={canEdit} />
    </AppShell>
  )
}
