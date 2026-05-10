import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, KPICard } from '@/components/ui/phb'
import { Leaf, FileText, ShieldAlert, CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function EudrHubPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const [pendentes, aprovadas, riscoCritico, total] = await Promise.all([
    db.dueDiligenceStatement.count({
      where: { ...scope.whereOwn(), conclusao: { in: ['rascunho', 'em_revisao'] } },
    }),
    db.dueDiligenceStatement.count({
      where: { ...scope.whereOwn(), conclusao: { in: ['aprovada', 'enviada_ue'] } },
    }),
    db.dueDiligenceStatement.count({
      where: { ...scope.whereOwn(), riscoNivel: 'critico' },
    }),
    db.dueDiligenceStatement.count({ where: scope.whereOwn() }),
  ])

  return (
    <AppShell>
      <PageHeader
        eyebrow="Compliance · EUDR"
        title="EUDR — Due Diligence"
        subtitle="Cadeia de custódia ambiental + Due Diligence Statement conforme Regulamento (UE) 2023/1115."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard eyebrow="Total DDS" value={String(total)} />
        <KPICard eyebrow="Pendentes" value={String(pendentes)} />
        <KPICard eyebrow="Aprovadas" value={String(aprovadas)} />
        <KPICard eyebrow="Risco crítico" value={String(riscoCritico)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/eudr/dds" className="block">
          <Card className="h-full hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-5 w-5 text-emerald-400" />
              <h3 className="font-semibold">Statements DDS</h3>
            </div>
            <p className="text-sm text-zinc-400">
              Lista, rascunhos, atestações e PDFs assinados.
            </p>
          </Card>
        </Link>
        <Link href="/eudr/dds/nova" className="block">
          <Card className="h-full hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <Leaf className="h-5 w-5 text-emerald-400" />
              <h3 className="font-semibold">Nova DDS</h3>
            </div>
            <p className="text-sm text-zinc-400">
              Wizard 5 passos: operador → produto → cadeia → risco → atestação.
            </p>
          </Card>
        </Link>
        <Link href="/propriedades" className="block">
          <Card className="h-full hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-2">
              <ShieldAlert className="h-5 w-5 text-emerald-400" />
              <h3 className="font-semibold">Propriedades</h3>
            </div>
            <p className="text-sm text-zinc-400">
              CAR, geo, sobreposições TI/UC/IBAMA e alertas MapBiomas.
            </p>
          </Card>
        </Link>
      </div>

      <Card className="mt-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5" />
          <div className="text-sm text-zinc-300">
            <p className="font-semibold mb-1">EUDR — Regulamento (UE) 2023/1115</p>
            <p className="text-zinc-400">
              Vigência: 30/12/2025. Exige DDS para exportar soja, café, cacau,
              óleo de palma, gado, borracha e madeira para a UE. Cutoff:
              31/12/2020 — propriedade não pode ter desmatamento posterior.
            </p>
          </div>
        </div>
      </Card>
    </AppShell>
  )
}
