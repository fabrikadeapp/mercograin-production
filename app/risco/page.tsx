import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { AppShell, PageHeader, Card, KPICard } from '@/components/ui/phb'
import { AlertTriangle, Shield, Target, TrendingDown } from 'lucide-react'
import { calcularExposicaoAtual } from '@/lib/risco/limites'

export const dynamic = 'force-dynamic'

function fmtUSD(n: number): string {
  return `US$ ${Math.round(n).toLocaleString('pt-BR')}`
}

export default async function RiscoHubPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const expo = await calcularExposicaoAtual(scope.workspaceId)

  const [breachesAbertos, posicoesAbertas, limitesAtivos] = await Promise.all([
    db.limiteBreach.count({
      where: { workspaceId: scope.workspaceId, resolvidoEm: null },
    }),
    db.posicaoHedge.count({
      where: { workspaceId: scope.workspaceId, status: 'aberta' },
    }),
    db.limiteRisco.count({
      where: { workspaceId: scope.workspaceId, ativo: true },
    }),
  ])

  return (
    <AppShell>
      <PageHeader title="Risco" subtitle="Painel de risco de mercado: VaR, limites, breaches e P&L hierárquico." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard eyebrow="Exposição aberta" value={fmtUSD(expo.total.usd)} />
        <KPICard eyebrow="Posições abertas" value={posicoesAbertas.toString()} />
        <KPICard eyebrow="Limites ativos" value={limitesAtivos.toString()} />
        <KPICard
          eyebrow="Breaches em aberto"
          value={breachesAbertos.toString()}
          highlightValue={breachesAbertos > 0}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { href: '/risco/var', title: 'Calculadora VaR', desc: 'Paramétrico · Histórico · Monte Carlo + Stress test' },
          { href: '/risco/limites', title: 'Limites de risco', desc: 'Por escopo: total, cultura, corretor, mesa, contraparte, região' },
          { href: '/risco/breaches', title: `Breaches (${breachesAbertos})`, desc: 'Histórico de breaches detectados, severidade e resolução' },
          { href: '/risco/pnl', title: 'P&L hierárquico', desc: 'Agregação por mesa, corretor e contrato vinculado' },
          { href: '/admin/mesas', title: 'Mesas', desc: 'Cadastro de mesas de operação' },
          { href: '/admin/corretores', title: 'Corretores', desc: 'Vínculo de mesa, usuário e comissão hierárquica' },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="block">
            <Card>
              <h3 className="text-h3 font-sans tracking-tight text-fg-1 mb-1">{c.title}</h3>
              <p className="text-sm text-fg-2">{c.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
