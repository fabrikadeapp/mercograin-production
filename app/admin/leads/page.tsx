/**
 * Super-admin: pipeline de leads B2B² (clientes do cliente).
 */
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { LeadsView } from './_components/LeadsView'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = session?.user as any
  if (!u?.id) redirect('/auth/login')
  if (u.role !== 'admin') redirect('/dashboard')
  return <LeadsView />
}
