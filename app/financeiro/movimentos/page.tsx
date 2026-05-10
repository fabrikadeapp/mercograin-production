import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'

export const dynamic = 'force-dynamic'

export default async function MovimentosPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const movimentos = await db.movimentoFinanceiro.findMany({
    where: scope.whereOwn(),
    include: {
      centroCusto: { select: { codigo: true, nome: true } },
      contrato: { select: { numero: true } },
    },
    orderBy: { data: 'desc' },
    take: 100,
  })

  return (
    <AppShell>
      <PageHeader
        title="Movimentos financeiros"
        subtitle={`${movimentos.length} movimento(s) recentes`}
      />
      <Card>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b">
                <th className="py-2">Data</th>
                <th>Tipo</th>
                <th>Natureza</th>
                <th>Descrição</th>
                <th>CC</th>
                <th>Contrato</th>
                <th className="text-right">Valor</th>
                <th>Concil.</th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2">
                    {new Date(m.data).toLocaleDateString('pt-BR')}
                  </td>
                  <td>
                    <span
                      className={
                        m.tipo === 'receita'
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }
                    >
                      {m.tipo}
                    </span>
                  </td>
                  <td>{m.natureza}</td>
                  <td className="max-w-xs truncate">{m.descricao}</td>
                  <td className="text-xs text-zinc-500">
                    {m.centroCusto?.codigo || '—'}
                  </td>
                  <td className="text-xs text-zinc-500">
                    {m.contrato?.numero || '—'}
                  </td>
                  <td className="text-right font-mono">
                    R${' '}
                    {Number(m.valor).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td>{m.conciliado ? '✓' : '—'}</td>
                </tr>
              ))}
              {movimentos.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-center text-zinc-500">
                    Nenhum movimento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  )
}
