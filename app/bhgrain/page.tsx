import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * /bhgrain → redireciona para /dashboard.
 *
 * Histórico: /bhgrain era o nome de um dashboard interno que mostrava o
 * produto BH Grain. Foi unificado com /dashboard (dados reais do workspace).
 */
export default function Page() {
  redirect('/dashboard')
}
