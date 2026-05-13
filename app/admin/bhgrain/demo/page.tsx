import { db } from '@/lib/db'
import { PageHeader, Card } from '@/components/ui/phb'
import { isDemoModeEnabled } from '@/lib/bhgrain/demo-mode'
import { setDemoModeAction } from './_actions'

export const dynamic = 'force-dynamic'

export default async function DemoPage() {
  const enabled = await isDemoModeEnabled()

  // Conta entidades demo já presentes (heurística: nome contém 'Cooperativa Agropecuária Vale Verde' etc)
  const [clienteDemo, totalClientes, totalPropostas] = await Promise.all([
    db.cliente.count({
      where: { nome: { contains: 'Cooperativa Agropecuária Vale Verde', mode: 'insensitive' } },
    }),
    db.cliente.count(),
    db.proposta.count(),
  ])

  return (
    <div>
      <PageHeader eyebrow="BH Grain" title="Modo demonstração" subtitle="Toggle global do banner + status de dados demo" />

      <Card className="p-4 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Banner global de "Modo demonstração"</div>
            <div className="text-xs opacity-70 mt-1">
              Quando ativado, aparece uma faixa amarela em todas as páginas /bhgrain alertando que dados podem ser fictícios.
            </div>
            <div className="text-xs opacity-70 mt-1">
              Status atual: <strong className={enabled ? 'text-amber-400' : 'text-green-400'}>{enabled ? 'ATIVADO' : 'desativado'}</strong>
            </div>
          </div>
          <form action={setDemoModeAction}>
            <input type="hidden" name="enabled" value={enabled ? '0' : '1'} />
            <button
              type="submit"
              className={`text-sm font-semibold rounded px-4 py-2 transition ${
                enabled
                  ? 'bg-gray-600 hover:bg-gray-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              {enabled ? 'Desativar' : 'Ativar'} modo demo
            </button>
          </form>
        </div>
      </Card>

      <Card className="p-4 mt-4">
        <h3 className="text-sm font-semibold mb-2">Estado atual dos dados</h3>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-black/10 rounded p-3">
            <div className="opacity-60">Clientes (total)</div>
            <div className="text-xl font-semibold tabular-nums">{totalClientes}</div>
          </div>
          <div className="bg-black/10 rounded p-3">
            <div className="opacity-60">Propostas (total)</div>
            <div className="text-xl font-semibold tabular-nums">{totalPropostas}</div>
          </div>
          <div className="bg-black/10 rounded p-3">
            <div className="opacity-60">Clientes de seed demo detectados</div>
            <div className="text-xl font-semibold tabular-nums">{clienteDemo > 0 ? 'sim' : '—'}</div>
          </div>
        </div>
      </Card>

      <Card className="p-4 mt-4">
        <h3 className="text-sm font-semibold mb-2">Carregar dados de demonstração</h3>
        <p className="text-xs opacity-70 mb-2">
          O seed <code>scripts/seed-mercograin-demo.ts</code> é idempotente — rodar várias vezes não duplica entradas.
        </p>
        <pre className="text-[11px] bg-black/30 rounded p-3 overflow-x-auto">
{`# No servidor de produção:
DATABASE_URL=$DATABASE_PUBLIC_URL npx tsx scripts/seed-mercograin-demo.ts`}
        </pre>
        <p className="text-xs opacity-60 mt-2">
          Atalho via npm: <code>npm run db:seed-demo</code>
        </p>
      </Card>
    </div>
  )
}
