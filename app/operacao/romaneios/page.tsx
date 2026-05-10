import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card, Button, Chip } from '@/components/ui/phb'
import { Plus } from 'lucide-react'
import { NovoRomaneioDialog } from './_components/NovoRomaneioDialog'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  em_transito: 'Em trânsito',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
}

const STATUS_VARIANT: Record<string, 'pos' | 'neg' | 'neutral'> = {
  rascunho: 'neutral',
  em_transito: 'pos',
  recebido: 'pos',
  cancelado: 'neg',
}

export default async function RomaneiosPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const status = searchParams.status
  const where: any = scope.whereOwn()
  if (status && STATUS_LABEL[status]) where.status = status

  const [romaneios, motoristas, contratos] = await Promise.all([
    db.romaneio.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        motorista: { select: { id: true, nome: true, placa: true } },
        ticketsBalanca: { select: { id: true, pesoLiquidoKg: true } },
      },
    }),
    db.motorista.findMany({
      where: { ...scope.whereOwn(), ativo: true },
      select: { id: true, nome: true, placa: true },
      orderBy: { nome: 'asc' },
    }),
    db.contrato.findMany({
      where: scope.whereOwn(),
      select: { id: true, numero: true },
      orderBy: { criadoEm: 'desc' },
      take: 200,
    }),
  ])

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operação · Romaneios"
        title="Romaneios"
        subtitle="Cargas vinculadas a contratos — saída, trânsito, recepção."
        actions={<NovoRomaneioDialog motoristas={motoristas} contratos={contratos} />}
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <Link href="/operacao/romaneios">
          <Chip variant={!status ? 'pos' : 'neutral'}>Todos</Chip>
        </Link>
        {Object.keys(STATUS_LABEL).map((s) => (
          <Link key={s} href={`/operacao/romaneios?status=${s}`}>
            <Chip variant={status === s ? 'pos' : 'neutral'}>{STATUS_LABEL[s]}</Chip>
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/50 text-left text-zinc-400">
            <tr>
              <th className="p-3">Número</th>
              <th className="p-3">Motorista / Placa</th>
              <th className="p-3">Origem → Destino</th>
              <th className="p-3">Cultura</th>
              <th className="p-3">Tickets</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {romaneios.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-zinc-500">
                  Nenhum romaneio encontrado.
                </td>
              </tr>
            ) : (
              romaneios.map((r) => {
                const totalKg = r.ticketsBalanca.reduce(
                  (a, t) => a + (t.pesoLiquidoKg || 0),
                  0
                )
                return (
                  <tr key={r.id} className="border-t border-zinc-800 hover:bg-zinc-900/30">
                    <td className="p-3 font-mono">{r.numero}</td>
                    <td className="p-3">
                      {r.motorista ? (
                        <>
                          {r.motorista.nome}
                          {r.motorista.placa ? (
                            <span className="text-zinc-500"> · {r.motorista.placa}</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {r.origem} <span className="text-zinc-600">→</span> {r.destino}
                    </td>
                    <td className="p-3 capitalize">{r.cultura}</td>
                    <td className="p-3">
                      {r.ticketsBalanca.length} ticket(s)
                      {totalKg > 0 ? (
                        <span className="text-zinc-500">
                          {' '}
                          · {(totalKg / 1000).toFixed(2)} t
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <Chip variant={STATUS_VARIANT[r.status] ?? 'neutral'}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Chip>
                    </td>
                    <td className="p-3">
                      <Link href={`/operacao/romaneios/${r.id}`}>
                        <Button variant="secondary" size="sm">
                          Detalhes
                        </Button>
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  )
}
