import { LandingPage } from './_landing/LandingPage'

// Página totalmente estática. Redirect de usuário logado → /dashboard
// é feito no middleware (não bloqueia o render aqui).
export const dynamic = 'force-static'

export default function Home() {
  return <LandingPage />
}
