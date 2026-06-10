import { LandingPage } from './_landing/LandingPage'

// Planos vêm do CMS (admin) — revalida a cada 10min mantendo cache de CDN/edge.
// Redirect de usuário logado → /dashboard é feito no middleware (não bloqueia o render aqui).
export const revalidate = 600

export default function Home() {
  return <LandingPage />
}
