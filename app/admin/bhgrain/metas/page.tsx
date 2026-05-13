import { db } from '@/lib/db'
import { PageHeader, Card } from '@/components/ui/phb'
import { createMeta, deleteMeta } from '../_actions'

export const dynamic = 'force-dynamic'

export default async function MetasPage() {
  const [metas, workspaces] = await Promise.all([
    db.metaComercial.findMany({
      orderBy: [{ periodo: 'desc' }, { workspaceId: 'asc' }],
      take: 200,
      include: { workspace: { select: { name: true } } },
    }),
    db.workspace.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  const hoje = new Date()
  const periodoDefault = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  return (
    <div>
      <PageHeader eyebrow="BH Grain" title="Metas comerciais" subtitle="Meta mensal por workspace × usuário × commodity" />

      <Card className="p-4 mt-4">
        <h3 className="text-sm font-semibold mb-3">Nova / atualizar meta</h3>
        <form action={createMeta} className="grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">
          <select name="workspaceId" required className="bg-black/20 border border-white/10 rounded px-2 py-1.5">
            <option value="">Workspace</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <input
            name="periodo"
            required
            defaultValue={periodoDefault}
            pattern="\d{4}-\d{2}"
            placeholder="YYYY-MM"
            className="bg-black/20 border border-white/10 rounded px-2 py-1.5"
          />
          <input
            name="valorMeta"
            required
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Valor (R$)"
            className="bg-black/20 border border-white/10 rounded px-2 py-1.5"
          />
          <input
            name="moeda"
            defaultValue="BRL"
            maxLength={3}
            placeholder="BRL"
            className="bg-black/20 border border-white/10 rounded px-2 py-1.5"
          />
          <input
            name="commodity"
            placeholder="Commodity (opcional)"
            className="bg-black/20 border border-white/10 rounded px-2 py-1.5"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded px-3 py-1.5 transition"
          >
            Salvar
          </button>
        </form>
        <p className="text-xs opacity-60 mt-2">Se já existir meta com mesmo workspace+período+commodity, será atualizada.</p>
      </Card>

      <Card className="p-0 mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-black/10">
              <th className="px-3 py-2">Workspace</th>
              <th className="px-3 py-2">Período</th>
              <th className="px-3 py-2">Usuário</th>
              <th className="px-3 py-2">Commodity</th>
              <th className="px-3 py-2 text-right">Meta</th>
              <th className="px-3 py-2">Moeda</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {metas.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center opacity-60">Nenhuma meta configurada.</td></tr>
            ) : (
              metas.map((m) => (
                <tr key={m.id} className="border-t border-white/5">
                  <td className="px-3 py-2">{m.workspace.name}</td>
                  <td className="px-3 py-2 tabular-nums">{m.periodo}</td>
                  <td className="px-3 py-2 opacity-70">{m.userId ?? '—'}</td>
                  <td className="px-3 py-2 opacity-70">{m.commodity ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(m.valorMeta).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 opacity-70">{m.moeda}</td>
                  <td className="px-3 py-2 text-right">
                    <form action={deleteMeta}>
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="text-xs text-red-400 hover:text-red-300">Excluir</button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
