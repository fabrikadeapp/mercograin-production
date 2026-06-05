import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { SolicitacoesView } from './_components/SolicitacoesView'

export const dynamic = 'force-dynamic'

export default async function SolicitacoesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  return <SolicitacoesView />
}
