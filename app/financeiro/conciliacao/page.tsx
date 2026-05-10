import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { ConciliacaoUploader } from './_components/ConciliacaoUploader'

export const dynamic = 'force-dynamic'

export default async function ConciliacaoPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const [pendentes, conciliados] = await Promise.all([
    db.movimentoFinanceiro.count({
      where: { ...scope.whereOwn(), conciliado: false },
    }),
    db.movimentoFinanceiro.count({
      where: { ...scope.whereOwn(), conciliado: true },
    }),
  ])

  return (
    <AppShell>
      <PageHeader
        title="Conciliação bancária"
        subtitle={`${conciliados} conciliados · ${pendentes} pendentes`}
      />
      <Card>
        <div className="p-5">
          <h3 className="font-semibold text-sm mb-3">Importar OFX</h3>
          <p className="text-xs text-zinc-500 mb-4">
            Faça upload do extrato exportado pelo seu banco (formato OFX 1.x ou 2.x).
            O sistema tentará match automático com movimentos existentes pela data e valor.
          </p>
          <ConciliacaoUploader />
        </div>
      </Card>
    </AppShell>
  )
}
