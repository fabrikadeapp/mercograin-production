import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { CLevelContent } from './CLevelContent'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="BI · Executivo"
        title="Painel C-Level"
        subtitle="Volume, EBITDA, ROIC, share regional, comissão e sinistralidade"
      />
      <CLevelContent />
    </AppShell>
  )
}
