import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'

export const dynamic = 'force-dynamic'

const SECTIONS = [
  {
    href: '/financeiro/movimentos',
    title: 'Movimentos financeiros',
    desc: 'Receitas, despesas e transferências',
  },
  {
    href: '/financeiro/centros-custo',
    title: 'Centros de custo',
    desc: 'Hierarquia para apuração gerencial',
  },
  {
    href: '/financeiro/conciliacao',
    title: 'Conciliação bancária',
    desc: 'Importar OFX e fazer match',
  },
  {
    href: '/financeiro/royalties',
    title: 'Royalties',
    desc: 'Apuração de royalties por cultivar',
  },
  {
    href: '/relatorios/dre',
    title: 'DRE',
    desc: 'Demonstração do Resultado do Exercício',
  },
  {
    href: '/relatorios/curva-abc',
    title: 'Curva ABC',
    desc: 'Análise de Pareto (clientes/fornecedores/produtos)',
  },
]

export default async function FinanceiroHub() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  return (
    <AppShell>
      <PageHeader title="Financeiro & Compliance" subtitle="Centro de custo, DRE, conciliação, royalties." />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="block">
            <Card>
              <div className="p-5">
                <h3 className="font-semibold text-sm">{s.title}</h3>
                <p className="text-xs text-zinc-500 mt-1">{s.desc}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
