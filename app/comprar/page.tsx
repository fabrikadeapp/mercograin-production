import { redirect } from 'next/navigation'

// Fluxo oficial de aquisição é SIGNUP-FIRST (/auth/signup → trial). O purchase-first
// (/comprar) foi descontinuado; redireciona para a página de preços preservando o
// plano escolhido, se houver. Mantido como rota para não quebrar links antigos.
export default function ComprarPage({
  searchParams,
}: {
  searchParams?: { plan?: string }
}) {
  const plan = searchParams?.plan
  redirect(plan ? `/auth/signup?plan=${encodeURIComponent(plan)}` : '/precos')
}
