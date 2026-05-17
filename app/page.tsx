import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { LandingPage } from './_landing/LandingPage'

// Não force-dynamic. O auth() já torna esta página dynamic
// naturalmente quando há cookie. Anônimos pegam o landing renderizado
// com cookies vazios — Next ainda pode cachear o HTML resultante via
// CDN edge se vier sem cookie de sessão.

export default async function Home() {
  const session = await auth()
  if (session) redirect('/dashboard')
  return <LandingPage />
}
