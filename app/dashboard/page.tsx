import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  // Dashboard único: BH Grain (NewDB v2)
  redirect('/bhgrain')
}
