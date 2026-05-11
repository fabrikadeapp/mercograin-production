import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet,
  Building,
  FileSpreadsheet,
  Coins,
  PieChart,
  BarChart3,
} from 'lucide-react'
import { VgAppShell, VgPageHeader } from '@/components/ui/visionglass'

export const dynamic = 'force-dynamic'

const SECTIONS = [
  {
    href: '/financeiro/movimentos',
    title: 'Movimentos financeiros',
    desc: 'Receitas, despesas e transferências',
    icon: Wallet,
  },
  {
    href: '/financeiro/centros-custo',
    title: 'Centros de custo',
    desc: 'Hierarquia para apuração gerencial',
    icon: Building,
  },
  {
    href: '/financeiro/conciliacao',
    title: 'Conciliação bancária',
    desc: 'Importar OFX e fazer match',
    icon: FileSpreadsheet,
  },
  {
    href: '/financeiro/royalties',
    title: 'Royalties',
    desc: 'Apuração de royalties por cultivar',
    icon: Coins,
  },
  {
    href: '/relatorios/dre',
    title: 'DRE',
    desc: 'Demonstração do Resultado do Exercício',
    icon: PieChart,
  },
  {
    href: '/relatorios/curva-abc',
    title: 'Curva ABC',
    desc: 'Análise de Pareto (clientes/fornecedores/produtos)',
    icon: BarChart3,
  },
]

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  return (
    <VgAppShell>
      <VgPageHeader
        title="Financeiro & Compliance"
        subtitle="Centro de custo, DRE, conciliação, royalties — toda a operação financeira em um só lugar."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map(({ href, title, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="vg-card vg-card--interactive block group"
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'var(--vg-accent-primary-muted)',
                  color: 'var(--vg-accent-primary)',
                }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-vg-h3 mb-1">{title}</h3>
                <p className="text-vg-label text-vg-fg-2">{desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </VgAppShell>
  )
}
