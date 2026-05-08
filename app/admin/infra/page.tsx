import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe/server'
import { fetchCepeaQuotes } from '@/lib/quotes/cepea'
import {
  PageHeader,
  Card,
  KPICard,
  DenseTable,
} from '@/components/ui/phb'
import { HealthIndicator, RelativeTime } from '../_components/atoms'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Check {
  name: string
  ok: boolean
  detail?: string
  ms: number
}

async function timed<T>(
  name: string,
  fn: () => Promise<T>,
  detail?: (r: T) => string,
): Promise<Check> {
  const t0 = Date.now()
  try {
    const r = await fn()
    return {
      name,
      ok: true,
      ms: Date.now() - t0,
      detail: detail ? detail(r) : undefined,
    }
  } catch (e) {
    return {
      name,
      ok: false,
      ms: Date.now() - t0,
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}

export default async function InfraPage() {
  const [pg, st, cepea, td, evo] = await Promise.all([
    timed('PostgreSQL', () => db.$queryRaw`SELECT 1`, () => 'SELECT 1 OK'),
    timed(
      'Stripe API',
      () => stripe.balance.retrieve(),
      (r) => {
        const a = r.available?.[0]
        return a
          ? `Saldo ${(a.amount / 100).toFixed(2)} ${a.currency.toUpperCase()}`
          : 'OK'
      },
    ),
    timed(
      'CEPEA',
      () => fetchCepeaQuotes(['soja']),
      (r) =>
        r.soja?.dataReferencia
          ? `Soja R$ ${r.soja.precoSc60?.toFixed(2)} · ${r.soja.dataReferencia}`
          : 'sem dados',
    ),
    timed(
      'Twelve Data',
      async () => {
        const key = process.env.TWELVE_DATA_API_KEY
        if (!key) throw new Error('TWELVE_DATA_API_KEY ausente')
        const r = await fetch(
          `https://api.twelvedata.com/quote?symbol=USD/BRL&apikey=${key}`,
          { signal: AbortSignal.timeout(5000), cache: 'no-store' },
        )
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return await r.json()
      },
      (r) =>
        (r as any)?.close
          ? `USD/BRL ${(r as any).close}`
          : (r as any)?.message ?? 'sem dados',
    ),
    timed(
      'Evolution API (WhatsApp)',
      async () => {
        const { getConnectionState } = await import('@/lib/whatsapp/evolution')
        return await getConnectionState()
      },
      (r) => `state=${(r as any).state}`,
    ),
  ])

  const recentErrors = await db.webhookLog.findMany({
    where: { status: 'erro' },
    orderBy: { criadoEm: 'desc' },
    take: 50,
  })

  const mem = process.memoryUsage()
  const uptimeSec = Math.round(process.uptime())
  const uptime =
    uptimeSec < 60
      ? `${uptimeSec}s`
      : uptimeSec < 3600
        ? `${Math.floor(uptimeSec / 60)}min`
        : uptimeSec < 86400
          ? `${(uptimeSec / 3600).toFixed(1)}h`
          : `${(uptimeSec / 86400).toFixed(1)}d`

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · INFRAESTRUTURA"
        title="Infraestrutura"
        subtitle="Health checks em tempo real · serviços externos"
        search={false}
        showBell={false}
      />

      {/* Health checks */}
      <Card className="p-5 mb-6">
        <h3 className="text-fg-1 text-h3 font-semibold mb-4">
          Status dos serviços
        </h3>
        <div className="space-y-3">
          {[pg, st, cepea, td, evo].map((c) => (
            <HealthIndicator
              key={c.name}
              ok={c.ok}
              label={c.name}
              detail={c.detail}
              ms={c.ms}
            />
          ))}
        </div>
      </Card>

      {/* Server stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KPICard
          eyebrow="Uptime"
          value={uptime}
          subtitle="process.uptime()"
        />
        <KPICard
          eyebrow="Memória RSS"
          value={`${(mem.rss / 1024 / 1024).toFixed(0)} MB`}
          subtitle={`Heap ${(mem.heapUsed / 1024 / 1024).toFixed(0)} MB`}
        />
        <KPICard
          eyebrow="Node"
          value={process.version}
          subtitle="Runtime"
        />
        <KPICard
          eyebrow="Next"
          value="14"
          subtitle="App Router"
        />
      </div>

      {/* Recent errors */}
      <h3 className="text-fg-1 text-h3 font-semibold mb-3">
        Últimos erros (webhook log)
      </h3>
      <DenseTable
        rowKey={(e) => e.id}
        rows={recentErrors}
        columns={[
          {
            key: 'tipo',
            header: 'Origem',
            accessor: (e) => (
              <span className="font-mono text-micro uppercase tracking-wider text-fg-2">
                {e.tipo}
              </span>
            ),
          },
          {
            key: 'codigo',
            header: 'Código',
            accessor: (e) =>
              e.codigoErro ? (
                <span className="text-neg font-mono text-micro">
                  {e.codigoErro}
                </span>
              ) : (
                <span className="text-fg-3">—</span>
              ),
          },
          {
            key: 'msg',
            header: 'Mensagem',
            accessor: (e) => (
              <span className="text-fg-1 text-small truncate block max-w-[400px]">
                {e.mensagem ?? '—'}
              </span>
            ),
          },
          {
            key: 'date',
            header: 'Quando',
            align: 'right',
            accessor: (e) => <RelativeTime date={e.criadoEm} />,
          },
        ]}
        empty="Nenhum erro recente — tudo ok!"
      />
    </>
  )
}
