import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { Receipt } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  rascunho: 'text-fg-3',
  enviada: 'text-fg-2',
  autorizada: 'text-pos',
  rejeitada: 'text-neg',
  cancelada: 'text-neg',
  inutilizada: 'text-fg-3',
  denegada: 'text-neg',
}

function fmtBRL(n: number | { toString(): string }): string {
  const v = typeof n === 'number' ? n : parseFloat(n.toString())
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function NotasFiscaisPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; tipo?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const params = (await searchParams) ?? {}
  const where: any = scope.whereOwn()
  if (params.status) where.status = params.status
  if (params.tipo) where.tipo = params.tipo

  const notas = await db.notaFiscal.findMany({
    where,
    orderBy: { dataEmissao: 'desc' },
    take: 100,
    include: { contrato: { select: { numero: true } } },
  })

  return (
    <AppShell>
      <PageHeader
        eyebrow="Fiscal · NF-e"
        title="Notas fiscais"
        subtitle="Histórico completo de NF-e emitidas, recebidas e em rascunho."
        actions={
          <Link
            href="/fiscal/notas/nova"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-ink text-small font-semibold hover:opacity-90"
          >
            <Receipt className="h-4 w-4" /> Nova NF-e
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterChip label="Todas" href="/fiscal/notas" active={!params.status && !params.tipo} />
        <FilterChip label="Autorizadas" href="/fiscal/notas?status=autorizada" active={params.status === 'autorizada'} />
        <FilterChip label="Rejeitadas" href="/fiscal/notas?status=rejeitada" active={params.status === 'rejeitada'} />
        <FilterChip label="Rascunho" href="/fiscal/notas?status=rascunho" active={params.status === 'rascunho'} />
        <FilterChip label="Canceladas" href="/fiscal/notas?status=cancelada" active={params.status === 'cancelada'} />
        <span className="w-px h-5 bg-border-1 mx-2" />
        <FilterChip label="Entradas" href="/fiscal/notas?tipo=entrada" active={params.tipo === 'entrada'} />
        <FilterChip label="Saídas" href="/fiscal/notas?tipo=saida" active={params.tipo === 'saida'} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead className="text-micro uppercase text-fg-3 bg-bg-2">
              <tr>
                <th className="px-4 py-3 text-left">Nº / Série</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Destinatário</th>
                <th className="px-4 py-3 text-left">Contrato</th>
                <th className="px-4 py-3 text-right">Valor total</th>
                <th className="px-4 py-3 text-left">Emissão</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {notas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-fg-3">
                    Nenhuma nota fiscal encontrada. <Link href="/fiscal/notas/nova" className="text-accent">Emitir primeira</Link>
                  </td>
                </tr>
              )}
              {notas.map((n) => (
                <tr key={n.id} className="border-t border-border-1 hover:bg-bg-2/50">
                  <td className="px-4 py-3 t-num">
                    {n.numero}/{n.serie}
                    {n.chave && (
                      <div className="text-micro text-fg-3 font-mono truncate max-w-[180px]">{n.chave.slice(-12)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{n.tipo}</td>
                  <td className="px-4 py-3">
                    <div className="text-fg-1 truncate max-w-[200px]">{n.destinatarioNome}</div>
                    <div className="text-micro text-fg-3">{n.destinatarioDoc} · {n.destinatarioUF}</div>
                  </td>
                  <td className="px-4 py-3 text-fg-2">{n.contrato?.numero ?? '—'}</td>
                  <td className="px-4 py-3 text-right t-num">{fmtBRL(n.valorTotal)}</td>
                  <td className="px-4 py-3 t-num text-fg-2">{new Date(n.dataEmissao).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-micro uppercase font-semibold ${STATUS_COLOR[n.status] ?? 'text-fg-2'}`}>
                      {n.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/fiscal/notas/${n.id}`} className="text-accent text-small">Ver</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  )
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-pill text-micro uppercase tracking-wider border transition ${
        active
          ? 'bg-accent text-accent-ink border-accent'
          : 'border-border-1 text-fg-2 hover:bg-bg-2'
      }`}
    >
      {label}
    </Link>
  )
}
