import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, KPICard } from '@/components/ui/phb'
import { Truck, Scale, Boxes } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OperacaoPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [emTransito, lotesAtivos, ticketsHoje, agg] = await Promise.all([
    db.romaneio.count({
      where: { ...scope.whereOwn(), status: 'em_transito' },
    }),
    db.loteEstoque.count({ where: { ...scope.whereOwn(), status: 'ativo' } }),
    db.ticketBalanca.count({
      where: { ...scope.whereOwn(), createdAt: { gte: todayStart } },
    }),
    db.loteEstoque.aggregate({
      where: { ...scope.whereOwn(), status: 'ativo' },
      _sum: { qtdAtualSc: true },
    }),
  ])

  const totalSc = Math.round(agg._sum.qtdAtualSc || 0)

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operações · Físico"
        title="Operação Física"
        subtitle="Romaneios, balança, classificação e estoque — a corretora rodando."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard eyebrow="Romaneios em trânsito" value={String(emTransito)} />
        <KPICard eyebrow="Lotes ativos" value={String(lotesAtivos)} />
        <KPICard eyebrow="Tickets hoje" value={String(ticketsHoje)} />
        <KPICard eyebrow="Estoque (sc)" value={totalSc.toLocaleString('pt-BR')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/operacao/romaneios" className="block">
          <Card className="h-full hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <Truck className="h-5 w-5 text-emerald-400" />
              <h3 className="font-semibold">Romaneios</h3>
            </div>
            <p className="text-sm text-zinc-400">
              Acompanhe cargas em trânsito, vincule contratos e finalize recepções.
            </p>
          </Card>
        </Link>
        <Link href="/operacao/balanca" className="block">
          <Card className="h-full hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <Scale className="h-5 w-5 text-emerald-400" />
              <h3 className="font-semibold">Balança</h3>
            </div>
            <p className="text-sm text-zinc-400">
              Pesagem rápida + classificação inline com cálculo de descontos.
            </p>
          </Card>
        </Link>
        <Link href="/operacao/estoque" className="block">
          <Card className="h-full hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <Boxes className="h-5 w-5 text-emerald-400" />
              <h3 className="font-semibold">Estoque</h3>
            </div>
            <p className="text-sm text-zinc-400">
              Lotes por armazém, transferências e quebras técnicas.
            </p>
          </Card>
        </Link>
      </div>
    </AppShell>
  )
}
