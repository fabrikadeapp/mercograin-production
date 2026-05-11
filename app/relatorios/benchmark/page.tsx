import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AppShell, PageHeader } from '@/components/ui/phb'
import { BenchmarkContent } from './BenchmarkContent'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="BI · Benchmark"
        title="Posição vs mercado"
        subtitle="Agregação anônima entre corretoras BH Grain"
      />
      <BenchmarkContent />
    </AppShell>
  )
}
