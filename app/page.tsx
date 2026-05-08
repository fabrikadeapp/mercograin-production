import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { LandingPage } from './_landing/LandingPage'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await auth()
  if (session) redirect('/dashboard')
  return <LandingPage />
}
