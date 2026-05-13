import { db } from '@/lib/db'
import { PageHeader, Card } from '@/components/ui/phb'

export const dynamic = 'force-dynamic'

export default async function AlertasPage() {
  const alertas = await db.commercialAlert.findMany({
    where: { status: 'aberto' },
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    include: { workspace: { select: { name: true } } },
  })

  return (
    <div>
      <PageHeader eyebrow="BH Grain" title="Alertas comerciais" subtitle={`${alertas.length} alertas abertos`} />
      <Card className="p-0 mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-black/10">
              <th className="px-3 py-2">Sev</th>
              <th className="px-3 py-2">Workspace</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Título</th>
              <th className="px-3 py-2">Criado</th>
            </tr>
          </thead>
          <tbody>
            {alertas.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center opacity-60">Nenhum alerta aberto.</td></tr>
            ) : (
              alertas.map((a) => (
                <tr key={a.id} className="border-t border-white/5">
                  <td className="px-3 py-2 uppercase text-xs">{a.severity}</td>
                  <td className="px-3 py-2">{a.workspace.name}</td>
                  <td className="px-3 py-2 opacity-70">{a.category}</td>
                  <td className="px-3 py-2">{a.title}</td>
                  <td className="px-3 py-2 opacity-60 tabular-nums">{a.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
