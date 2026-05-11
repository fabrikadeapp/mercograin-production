import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AiSettingsForm } from './_components/AiSettingsForm'

export const dynamic = 'force-dynamic'

export default async function AiSettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const ws = await db.workspace.findUnique({
    where: { id: scope.workspaceId },
    select: {
      aiMode: true,
      aiKeyEncrypted: true,
      aiModel: true,
      subscription: { select: { plan: true } },
    },
  })

  const canEdit =
    scope.isAdmin || scope.workspaceRole === 'owner' || scope.workspaceRole === 'admin'

  const planSlug = ws?.subscription?.plan ?? null
  const plan = planSlug
    ? await db.plan.findUnique({
        where: { slug: planSlug },
        select: { slug: true, name: true, aiAccess: true, aiMonthlyMessages: true },
      })
    : null

  return (
    <AppShell>
      <PageHeader
        eyebrow="Configurações"
        title="Agente AI"
        subtitle="Configure como o agente AI desta workspace consome modelos OpenAI. No modo gerenciado a plataforma paga; no BYOK você traz sua própria chave."
        search={false}
      />
      <AiSettingsForm
        canEdit={canEdit}
        initialMode={ws?.aiMode ?? 'managed'}
        initialModel={ws?.aiModel ?? 'gpt-4o-mini'}
        initialHasKey={!!ws?.aiKeyEncrypted}
        plan={
          plan
            ? {
                slug: plan.slug,
                name: plan.name,
                aiAccess: plan.aiAccess,
                aiMonthlyMessages: plan.aiMonthlyMessages,
              }
            : null
        }
      />
    </AppShell>
  )
}
