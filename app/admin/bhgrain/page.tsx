import { db } from '@/lib/db'
import { PageHeader, Card } from '@/components/ui/phb'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function BhGrainAdminIndex() {
  const flagRow = await db.systemConfig.findUnique({ where: { key: 'bhgrain.v1' } }).catch(() => null)
  const enabled = !!(flagRow?.value as { enabled?: boolean } | null)?.enabled

  const [metas, regras, alertas, integracoes] = await Promise.all([
    db.metaComercial.count(),
    db.commercialRule.count(),
    db.commercialAlert.count({ where: { status: 'aberto' } }),
    db.integrationHealth.count(),
  ])

  const links = [
    { href: '/admin/bhgrain/metas', label: 'Metas comerciais', value: `${metas} configuradas` },
    { href: '/admin/bhgrain/regras', label: 'Regras comerciais', value: `${regras} ativas` },
    { href: '/admin/bhgrain/alertas', label: 'Alertas comerciais', value: `${alertas} abertos` },
    { href: '/admin/bhgrain/integracoes', label: 'Health de integrações', value: `${integracoes} monitoradas` },
    { href: '/admin/bhgrain/perdas', label: 'Análise de perdas', value: 'consolidado por motivo' },
    { href: '/admin/bhgrain/commodity', label: 'Análise por commodity', value: 'receita/margem/conversão' },
    { href: '/admin/bhgrain/importar', label: 'Importar dados', value: 'CSV de clientes (preview + commit)' },
    { href: '/admin/bhgrain/demo', label: 'Modo demonstração', value: 'banner global + seed idempotente' },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="BH Grain · SaaS global"
        title="Inteligência comercial"
        subtitle={`Feature flag bhgrain.v1: ${enabled ? 'ON' : 'OFF'}`}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="p-4 hover:opacity-90 transition cursor-pointer">
              <div className="text-sm font-semibold">{l.label}</div>
              <div className="text-xs opacity-70 mt-1">{l.value}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
