import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { NovaPosicaoForm } from '../../_components/NovaPosicaoForm'

export const dynamic = 'force-dynamic'

export default async function NovaPosicaoPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Hedge"
        title="Nova posição"
        subtitle="Long ou Short — registre operação na bolsa (CBOT/B3) com câmbio de entrada."
      />
      <NovaPosicaoForm />
    </AppShell>
  )
}
