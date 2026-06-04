/**
 * Super-admin: kill-switches globais por feature.
 * Quando off aqui, NENHUM workspace consegue ligar a feature.
 */
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { SystemFeaturesView } from './_components/SystemFeaturesView'

export const dynamic = 'force-dynamic'

export default async function SystemFeaturesPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = session?.user as any
  if (!u?.id) redirect('/auth/login')
  if (u.role !== 'admin') redirect('/dashboard')
  return <SystemFeaturesView />
}
