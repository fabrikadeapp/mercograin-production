import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Plus, BarChart3, Users, TrendingUp } from 'lucide-react'
import { AppShell, PageHeader, Button, Card } from '@/components/ui/phb'
import { RelatoriosContent } from './_components/RelatoriosContent'

export const dynamic = 'force-dynamic'

const BI_PANELS = [
  {
    href: '/relatorios/clevel',
    eyebrow: 'EXECUTIVO',
    title: 'Painel C-Level',
    desc: 'Volume, EBITDA, ROIC, share regional e comissão.',
    Icon: BarChart3,
  },
  {
    href: '/relatorios/benchmark',
    eyebrow: 'MERCADO',
    title: 'Benchmark anônimo',
    desc: 'Posição vs outras corretoras BH Grain.',
    Icon: TrendingUp,
  },
  {
    href: '/corretores',
    eyebrow: 'CORRETOR',
    title: 'Desempenho por corretor',
    desc: 'Ranking, hit rate e tempo de fechamento.',
    Icon: Users,
  },
]

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <AppShell>
      <PageHeader
        eyebrow="Análises · Safra 24/25"
        title="Relatórios"
        subtitle="Composição de margem e desempenho por canal"
        actions={
          <>
            <Button variant="secondary" leftIcon={<Calendar className="h-4 w-4" />}>
              Safra 24/25
            </Button>
            <Button variant="ghost">PDF</Button>
            <Button leftIcon={<Plus className="h-4 w-4" />}>Novo relatório</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {BI_PANELS.map((p) => {
          const Icon = p.Icon
          return (
            <Link key={p.href} href={p.href} className="block group">
              <Card className="p-5 h-full transition border border-border-1 group-hover:border-accent">
                <div className="flex items-start gap-3">
                  <div className="rounded-md p-2 bg-bg-2">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="eyebrow">{p.eyebrow}</p>
                    <p className="text-fg-1 font-medium">{p.title}</p>
                    <p className="text-fg-3 text-small">{p.desc}</p>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>

      <RelatoriosContent />
    </AppShell>
  )
}
