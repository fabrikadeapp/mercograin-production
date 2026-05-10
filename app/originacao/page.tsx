import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, KPICard } from '@/components/ui/phb'
import { Target, Banknote, Package, BarChart3 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function OriginacaoPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const [fixacoesPendentes, adiantamentosAbertos, barterAtivos, planos] =
    await Promise.all([
      db.contratoFixacao.count({
        where: {
          ...scope.whereOwn(),
          statusFixacao: { in: ['pendente', 'parcial'] },
        },
      }),
      db.adiantamento.count({
        where: { ...scope.whereOwn(), status: { in: ['aberto', 'parcial'] } },
      }),
      db.barterInsumo.count({
        where: {
          ...scope.whereOwn(),
          status: { in: ['pendente', 'entregue'] },
        },
      }),
      db.planoVendas.count({
        where: { ...scope.whereOwn(), status: 'ativo' },
      }),
    ])

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operações · Originação"
        title="Originação & Fixação"
        subtitle="Preço a fixar, barter, adiantamentos e plano de vendas — onde a corretora origina o grão."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard eyebrow="Fixações pendentes" value={String(fixacoesPendentes)} />
        <KPICard
          eyebrow="Adiantamentos abertos"
          value={String(adiantamentosAbertos)}
        />
        <KPICard eyebrow="Barter ativos" value={String(barterAtivos)} />
        <KPICard eyebrow="Planos de venda" value={String(planos)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/originacao/fixacoes" className="block">
          <Card className="h-full hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <Target className="h-5 w-5 text-emerald-400" />
              <h3 className="font-semibold">Fixações</h3>
            </div>
            <p className="text-sm text-zinc-400">
              Contratos a fixar — janelas, fixações parciais e gatilhos de
              mercado.
            </p>
          </Card>
        </Link>
        <Link href="/originacao/adiantamentos" className="block">
          <Card className="h-full hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <Banknote className="h-5 w-5 text-emerald-400" />
              <h3 className="font-semibold">Adiantamentos</h3>
            </div>
            <p className="text-sm text-zinc-400">
              Cash ou insumo ao produtor, abatidos pela entrega física.
            </p>
          </Card>
        </Link>
        <Link href="/originacao/barter" className="block">
          <Card className="h-full hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <Package className="h-5 w-5 text-emerald-400" />
              <h3 className="font-semibold">Barter</h3>
            </div>
            <p className="text-sm text-zinc-400">
              Insumo entregue, equivalência em sacas e quitação em grão.
            </p>
          </Card>
        </Link>
        <Link href="/originacao/plano-vendas" className="block">
          <Card className="h-full hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="h-5 w-5 text-emerald-400" />
              <h3 className="font-semibold">Plano de Vendas</h3>
            </div>
            <p className="text-sm text-zinc-400">
              Forecast por safra/cultura e progresso vs realizado.
            </p>
          </Card>
        </Link>
      </div>
    </AppShell>
  )
}
