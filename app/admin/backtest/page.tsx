import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { BacktestContent } from './_components/BacktestContent'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Backtest da Inteligência' }

/**
 * Página "Backtest da Inteligência" — EXCLUSIVA SUPERADMIN.
 *
 * Roda o backtest da inteligência de mercado contra o preço físico histórico
 * (IPEA/DERAL — gabarito), reconstruindo mês a mês o sinal que a inteligência
 * teria dado e medindo taxa de acerto, retorno vs baseline e calibração de
 * pesos. Consome GET /api/admin/backtest (que também é gated por superadmin).
 */
export default async function BacktestPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (user?.role !== 'admin') redirect('/dashboard')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin · Inteligência"
        title="Backtest da Inteligência"
        subtitle="Valida o motor de recomendação contra o preço físico histórico (IPEA/DERAL). Mede taxa de acerto, retorno do sinal vs baseline e sugere a calibração de pesos por fator."
      />
      <BacktestContent />
    </AppShell>
  )
}
