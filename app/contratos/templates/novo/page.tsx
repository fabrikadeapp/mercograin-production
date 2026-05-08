import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { TemplateForm } from '../_TemplateForm'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Contratos · Templates"
        title="Novo template"
        subtitle="Crie um modelo reutilizável com variáveis dinâmicas"
      />
      <TemplateForm mode="create" />
    </AppShell>
  )
}
