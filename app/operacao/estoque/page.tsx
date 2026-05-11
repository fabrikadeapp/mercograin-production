import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { Plus } from 'lucide-react'
import { AppShell, PageHeader, Card, Chip, Button } from '@/components/ui/phb'

export const dynamic = 'force-dynamic'

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: { armazemId?: string; cultura?: string; safraId?: string; status?: string }
}) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const filters: any = { status: searchParams.status || 'ativo' }
  if (searchParams.armazemId) filters.armazemId = searchParams.armazemId
  if (searchParams.cultura) filters.cultura = searchParams.cultura
  if (searchParams.safraId) filters.safraId = searchParams.safraId

  const [lotes, armazens, safras] = await Promise.all([
    db.loteEstoque.findMany({
      where: scope.whereOwn(filters),
      include: {
        armazem: { select: { id: true, nome: true } },
        safra: { select: { id: true, nome: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.armazem.findMany({
      where: { ...scope.whereOwn(), ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    db.safra.findMany({
      where: scope.whereOwn(),
      select: { id: true, nome: true, cultura: true },
      orderBy: { inicio: 'desc' },
    }),
  ])

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operação · Estoque"
        title="Lotes de estoque"
        subtitle="Saldo por armazém + cultura + safra. Quebras, transferências e rebaixe."
        actions={
          <Link href="/operacao/estoque/novo">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Novo lote</Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <form className="grid grid-cols-1 md:grid-cols-4 gap-3" method="GET">
          <select
            name="cultura"
            defaultValue={searchParams.cultura || ''}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 h-10 text-sm"
          >
            <option value="">Todas culturas</option>
            <option value="soja">Soja</option>
            <option value="milho">Milho</option>
            <option value="trigo">Trigo</option>
          </select>
          <select
            name="armazemId"
            defaultValue={searchParams.armazemId || ''}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 h-10 text-sm"
          >
            <option value="">Todos armazéns</option>
            {armazens.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
          <select
            name="safraId"
            defaultValue={searchParams.safraId || ''}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 h-10 text-sm"
          >
            <option value="">Todas safras</option>
            {safras.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} · {s.cultura}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/50 text-left text-zinc-400">
            <tr>
              <th className="p-3">Número</th>
              <th className="p-3">Cultura</th>
              <th className="p-3">Armazém</th>
              <th className="p-3">Safra</th>
              <th className="p-3 text-right">Inicial (sc)</th>
              <th className="p-3 text-right">Atual (sc)</th>
              <th className="p-3">Umid. méd.</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {lotes.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-zinc-500">
                  Nenhum lote encontrado.
                </td>
              </tr>
            ) : (
              lotes.map((l) => (
                <tr key={l.id} className="border-t border-zinc-800 hover:bg-zinc-900/30">
                  <td className="p-3 font-mono">{l.numero}</td>
                  <td className="p-3 capitalize">{l.cultura}</td>
                  <td className="p-3">{l.armazem.nome}</td>
                  <td className="p-3">{l.safra?.nome || '—'}</td>
                  <td className="p-3 text-right font-mono">
                    {l.qtdInicialSc.toLocaleString('pt-BR')}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-400">
                    {l.qtdAtualSc.toLocaleString('pt-BR')}
                  </td>
                  <td className="p-3">
                    {l.umidadeMedia ? `${l.umidadeMedia.toFixed(1)}%` : '—'}
                  </td>
                  <td className="p-3">
                    <Chip variant={l.status === 'ativo' ? 'pos' : 'neutral'}>{l.status}</Chip>
                  </td>
                  <td className="p-3">
                    <Link href={`/operacao/estoque/${l.id}`}>
                      <Button variant="secondary" size="sm">
                        Detalhes
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  )
}
