import { db } from '@/lib/db'
import { PageHeader, Card } from '@/components/ui/phb'
import { createRegra, toggleRegra, deleteRegra } from '../_actions'
import { REGRA_TIPOS, REGRA_ACOES } from '../_constants'

export const dynamic = 'force-dynamic'

export default async function RegrasPage() {
  const [regras, workspaces] = await Promise.all([
    db.commercialRule.findMany({
      orderBy: [{ workspaceId: 'asc' }, { type: 'asc' }],
      take: 200,
      include: { workspace: { select: { name: true } } },
    }),
    db.workspace.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  return (
    <div>
      <PageHeader
        eyebrow="BH Grain"
        title="Regras comerciais"
        subtitle="Margem mínima, validade, aprovações"
      />

      <Card className="p-4 mt-4">
        <h3 className="text-sm font-semibold mb-3">Nova regra</h3>
        <form action={createRegra} className="grid grid-cols-1 md:grid-cols-7 gap-3 text-sm">
          <select name="workspaceId" required className="bg-black/20 border border-white/10 rounded px-2 py-1.5 md:col-span-2">
            <option value="">Workspace</option>
            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <input
            name="name"
            required
            placeholder="Nome da regra"
            className="bg-black/20 border border-white/10 rounded px-2 py-1.5"
          />
          <select name="type" required className="bg-black/20 border border-white/10 rounded px-2 py-1.5">
            {REGRA_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            name="commodity"
            placeholder="Commodity (opt)"
            className="bg-black/20 border border-white/10 rounded px-2 py-1.5"
          />
          <input
            name="threshold"
            placeholder="Threshold (opt)"
            className="bg-black/20 border border-white/10 rounded px-2 py-1.5"
          />
          <select name="action" required className="bg-black/20 border border-white/10 rounded px-2 py-1.5">
            {REGRA_ACOES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <label className="flex items-center gap-2 md:col-span-6 text-xs">
            <input name="active" type="checkbox" defaultChecked /> Ativa
          </label>
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded px-3 py-1.5 transition">
            Criar
          </button>
        </form>
      </Card>

      <Card className="p-0 mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-black/10">
              <th className="px-3 py-2">Workspace</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Commodity</th>
              <th className="px-3 py-2 text-right">Threshold</th>
              <th className="px-3 py-2">Ação</th>
              <th className="px-3 py-2">Ativa</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {regras.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center opacity-60">Nenhuma regra cadastrada.</td></tr>
            ) : (
              regras.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2">{r.workspace.name}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 opacity-70 text-xs">{r.type}</td>
                  <td className="px-3 py-2 opacity-70">{r.commodity ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.threshold != null ? Number(r.threshold) : '—'}</td>
                  <td className="px-3 py-2 opacity-70">{r.action}</td>
                  <td className="px-3 py-2">
                    <form action={toggleRegra} className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className={`text-xs ${r.active ? 'text-green-400' : 'text-gray-500'}`}>
                        {r.active ? '✓' : '○'}
                      </button>
                    </form>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <form action={deleteRegra}>
                      <input type="hidden" name="id" value={r.id} />
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
