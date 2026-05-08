import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { PageHeader, DenseTable, Card, Chip, Button } from '@/components/ui/phb'
import Link from 'next/link'
import { RelativeTime } from '../../_components/atoms'

export const dynamic = 'force-dynamic'

const STATUS_TABS = [
  { id: 'all', label: 'Todos' },
  { id: 'ativo', label: 'Ativos' },
  { id: 'pausado', label: 'Pausados' },
  { id: 'fechado', label: 'Fechados' },
] as const

export default async function ClassificadosAdmin({
  searchParams,
}: {
  searchParams?: { status?: string; grao?: string; q?: string }
}) {
  const status = searchParams?.status ?? 'all'
  const grao = searchParams?.grao ?? 'all'
  const q = (searchParams?.q ?? '').trim()

  const where: Prisma.ClassificadoWhereInput = {}
  if (status !== 'all') where.status = status
  if (grao !== 'all') where.grao = grao
  if (q) {
    where.OR = [
      { cidade: { contains: q, mode: 'insensitive' } },
      { autor: { nome: { contains: q, mode: 'insensitive' } } },
      { autor: { email: { contains: q, mode: 'insensitive' } } },
    ]
  }

  const [items, total] = await Promise.all([
    db.classificado.findMany({
      where,
      include: { autor: { select: { id: true, nome: true, email: true } } },
      orderBy: { criadoEm: 'desc' },
      take: 100,
    }),
    db.classificado.count({ where }),
  ])

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · CONTEÚDO"
        title="Classificados"
        subtitle={`${total} anúncios · moderação global`}
        search={false}
        showBell={false}
        actions={
          <div className="flex gap-2">
            <Link
              href="/admin/conteudo/classificados"
              className="px-3 py-2 rounded-md bg-bg-2 hover:bg-bg-3 border border-border-1 text-fg-1 text-small"
            >
              Classificados
            </Link>
            <Link
              href="/admin/conteudo/alertas"
              className="px-3 py-2 rounded-md bg-bg-2 hover:bg-bg-3 border border-border-1 text-fg-3 text-small"
            >
              Alertas
            </Link>
          </div>
        }
      />

      <Card className="p-4 mb-6">
        <form
          method="GET"
          action="/admin/conteudo/classificados"
          className="flex flex-wrap items-center gap-3"
        >
          {STATUS_TABS.map((t) => {
            const active = status === t.id
            return (
              <Link
                key={t.id}
                href={
                  t.id === 'all'
                    ? '/admin/conteudo/classificados'
                    : `/admin/conteudo/classificados?status=${t.id}`
                }
                className={`px-3 py-1.5 rounded-pill text-small font-medium border transition ${
                  active
                    ? 'bg-accent text-[var(--accent-ink)] border-transparent'
                    : 'bg-bg-2 text-fg-2 border-border-1 hover:bg-bg-3'
                }`}
              >
                {t.label}
              </Link>
            )
          })}
          <div className="ml-auto flex gap-2">
            <select
              name="grao"
              defaultValue={grao}
              className="px-3 py-2 bg-bg-2 border border-border-1 rounded-md text-fg-1 text-small"
            >
              <option value="all">Todos grãos</option>
              <option value="soja">Soja</option>
              <option value="milho">Milho</option>
              <option value="trigo">Trigo</option>
              <option value="sorgo">Sorgo</option>
            </select>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Cidade, autor…"
              className="px-3 py-2 bg-bg-2 border border-border-1 rounded-md text-fg-1 text-small w-72"
            />
            {status !== 'all' && (
              <input type="hidden" name="status" value={status} />
            )}
            <Button type="submit" size="sm">
              Filtrar
            </Button>
          </div>
        </form>
      </Card>

      <DenseTable
        rowKey={(r) => r.id}
        rows={items}
        columns={[
          {
            key: 'tipo',
            header: 'Tipo',
            accessor: (r) => (
              <Chip variant={r.tipo === 'venda' ? 'pos' : 'warn'}>
                {r.tipo}
              </Chip>
            ),
          },
          {
            key: 'grao',
            header: 'Grão',
            accessor: (r) => (
              <span className="text-fg-1 capitalize">{r.grao}</span>
            ),
          },
          {
            key: 'volume',
            header: 'Volume',
            align: 'right',
            isNumeric: true,
            accessor: (r) => `${r.volumeSc.toLocaleString('pt-BR')} sc`,
          },
          {
            key: 'preco',
            header: 'Preço/sc',
            align: 'right',
            isNumeric: true,
            accessor: (r) => `R$ ${Number(r.precoSc).toFixed(2)}`,
          },
          {
            key: 'local',
            header: 'Local',
            accessor: (r) => `${r.cidade}/${r.uf}`,
          },
          {
            key: 'autor',
            header: 'Autor',
            accessor: (r) => (
              <Link
                href={`/admin/usuarios/${r.autor.id}`}
                className="hover:text-accent text-small"
              >
                {r.autor.nome}
              </Link>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            accessor: (r) => (
              <Chip
                variant={
                  r.status === 'ativo'
                    ? 'pos'
                    : r.status === 'pausado'
                      ? 'warn'
                      : 'neutral'
                }
              >
                {r.status}
              </Chip>
            ),
          },
          {
            key: 'date',
            header: 'Criado',
            align: 'right',
            accessor: (r) => <RelativeTime date={r.criadoEm} />,
          },
        ]}
        empty="Nenhum classificado encontrado"
      />
    </>
  )
}
