import { db } from '@/lib/db'
import { PageHeader, Card } from '@/components/ui/phb'
import { setLossReason } from '../_actions'
import { LOSS_REASONS_ARR } from '../_constants'

export const dynamic = 'force-dynamic'

export default async function PerdasPage() {
  const [recusadas, semMotivo] = await Promise.all([
    db.proposta.findMany({
      where: { status: 'recusada' },
      select: { lossReason: true, valorTotal: true },
      take: 5000,
    }),
    db.proposta.findMany({
      where: { status: 'recusada', lossReason: null },
      orderBy: { atualizadaEm: 'desc' },
      take: 30,
      include: { cliente: { select: { nome: true } }, workspace: { select: { name: true } } },
    }),
  ])

  const counts = new Map<string, { count: number; valor: number }>()
  for (const p of recusadas) {
    const k = p.lossReason ?? 'Não informado'
    const cur = counts.get(k) ?? { count: 0, valor: 0 }
    cur.count += 1
    cur.valor += Number(p.valorTotal)
    counts.set(k, cur)
  }
  const rows = Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count)
  const total = recusadas.length

  return (
    <div>
      <PageHeader eyebrow="BH Grain" title="Análise de perdas" subtitle={`${total} propostas recusadas · ${semMotivo.length} sem motivo`} />

      <Card className="p-0 mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-black/10">
              <th className="px-3 py-2">Motivo</th>
              <th className="px-3 py-2 text-right">Propostas</th>
              <th className="px-3 py-2 text-right">%</th>
              <th className="px-3 py-2 text-right">Valor perdido</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center opacity-60">Sem propostas recusadas.</td></tr>
            ) : (
              rows.map(([motivo, info]) => (
                <tr key={motivo} className="border-t border-white/5">
                  <td className="px-3 py-2">{motivo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{info.count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{total > 0 ? Math.round((info.count / total) * 100) : 0}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">R$ {info.valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {semMotivo.length > 0 && (
        <Card className="p-4 mt-4">
          <h3 className="text-sm font-semibold mb-3">Propostas recusadas sem motivo registrado</h3>
          <div className="space-y-2">
            {semMotivo.map((p) => (
              <form
                key={p.id}
                action={setLossReason}
                className="flex flex-wrap items-center gap-2 p-2 rounded bg-black/10 text-sm"
              >
                <input type="hidden" name="propostaId" value={p.id} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{p.cliente.nome}</div>
                  <div className="text-xs opacity-60">
                    {p.workspace.name} · {p.numero} · R$ {Number(p.valorTotal).toLocaleString('pt-BR')}
                  </div>
                </div>
                <select name="reason" required defaultValue="" className="bg-black/30 border border-white/10 rounded px-2 py-1 text-xs">
                  <option value="" disabled>Motivo</option>
                  {LOSS_REASONS_ARR.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button type="submit" className="text-xs bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1">
                  Salvar
                </button>
              </form>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
