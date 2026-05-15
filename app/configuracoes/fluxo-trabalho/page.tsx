import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getScope } from '@/lib/auth/scope'
import { listMarginRules } from '@/lib/bhgrain/margin-rules'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { MarginsCard } from './_margins-ui'

export const dynamic = 'force-dynamic'

/**
 * /configuracoes/fluxo-trabalho — central de regras comerciais do workspace.
 *
 * Hoje:
 *  - Margens por commodity (CommodityMarginRule)
 *
 * Próximo (backlog):
 *  - Limites de aprovação (qual valor exige assinatura do diretor)
 *  - Templates de proposta (texto padrão por commodity)
 *  - Validade padrão da cotação (em horas)
 *  - Regras de score IA (peso de cada fator)
 */
export default async function FluxoTrabalhoPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const allowed = scope.isAdmin || ['owner', 'admin'].includes(scope.workspaceRole)
  if (!allowed) redirect('/dashboard')

  // Carrega regras + (best-effort) preço de referência da soja para mostrar exemplo
  const rules = await listMarginRules(scope.workspaceId).catch(() => [])

  let precoRefSoja: number | null = null
  try {
    // Best-effort: pega o spot CEPEA da soja via endpoint interno.
    // Falha silenciosa — a página funciona sem o exemplo numérico.
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const r = await fetch(`${baseUrl}/api/bhgrain/precos`, {
      cache: 'no-store',
      headers: { cookie: '' },
    }).catch(() => null)
    if (r && r.ok) {
      const j = (await r.json()) as {
        grains?: Array<{ grao: string; spot?: { precoBrlSc?: number | null } }>
      }
      const soja = j.grains?.find((g) => g.grao === 'soja')
      precoRefSoja = soja?.spot?.precoBrlSc ?? null
    }
  } catch {
    /* silencioso */
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="BH Grain · Workspace"
        title="Fluxo de trabalho"
        subtitle="Regras comerciais que regem como sua mesa opera. Aplicadas automaticamente nas propostas."
      />

      <div className="grid grid-cols-1 gap-4 mt-4">
        <Card className="p-4">
          <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
            <div>
              <h2 className="text-base font-semibold">Margens por commodity</h2>
              <p className="text-xs opacity-70 mt-1">
                Define a margem comercial padrão de cada grão. Toda proposta nova herda
                automaticamente. Você pode sobrescrever caso a caso.
              </p>
            </div>
            <div className="text-[11px] opacity-60">
              {rules.length} {rules.length === 1 ? 'regra' : 'regras'} cadastrada
              {rules.length === 1 ? '' : 's'}
            </div>
          </div>
          <MarginsCard rules={rules} precoRefSoja={precoRefSoja} />
        </Card>

        {/* Roadmap visível pro cliente */}
        <Card className="p-4 text-xs" style={{ background: 'var(--surface-2)' }}>
          <h3 className="text-sm font-semibold mb-2">Em breve nesta página</h3>
          <ul className="space-y-1 opacity-70 list-disc pl-5">
            <li>Limites de aprovação (qual valor exige assinatura do diretor)</li>
            <li>Templates de proposta (texto e cláusulas padrão por commodity)</li>
            <li>Validade padrão da cotação (em horas)</li>
            <li>Regras de score IA (peso de cada fator)</li>
            <li>Workflow de follow-up automático no Inbox</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  )
}
