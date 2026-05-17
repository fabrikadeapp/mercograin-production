export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'

async function checkDb(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const t0 = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    return { ok: true, latencyMs: Date.now() - t0 }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : 'unknown',
    }
  }
}

async function checkCrons(): Promise<{ ok: boolean; recentRuns: number; failures: number }> {
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000)
    const [total, failures] = await Promise.all([
      db.cronExecution.count({ where: { startedAt: { gte: since } } }),
      db.cronExecution.count({
        where: { startedAt: { gte: since }, status: 'error' },
      }),
    ])
    return { ok: failures === 0, recentRuns: total, failures }
  } catch {
    return { ok: false, recentRuns: 0, failures: 0 }
  }
}

export default async function StatusPage() {
  const [dbStatus, cronStatus] = await Promise.all([checkDb(), checkCrons()])
  const overallOk = dbStatus.ok && cronStatus.ok

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 720, margin: '40px auto' }}>
        <header style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: 'var(--f-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-dim)',
              marginBottom: 6,
            }}
          >
            BH GRAIN · STATUS
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 600, margin: 0 }}>
            {overallOk ? 'Tudo operacional' : 'Alguns componentes com problema'}
          </h1>
          <div
            style={{
              marginTop: 12,
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: 12,
              background: overallOk ? 'var(--success-soft, rgba(64,200,100,0.1))' : 'rgba(255,180,0,0.1)',
              color: overallOk ? 'var(--success)' : 'var(--warning)',
              fontWeight: 600,
            }}
          >
            {overallOk ? '● Operacional' : '◐ Atenção'}
          </div>
        </header>

        <section style={{ display: 'grid', gap: 12 }}>
          <Component
            name="Aplicação (Next.js)"
            ok={true}
            detail="Servindo requests"
          />
          <Component
            name="Banco de dados (PostgreSQL)"
            ok={dbStatus.ok}
            detail={
              dbStatus.ok
                ? `Latência ${dbStatus.latencyMs}ms`
                : `Falha: ${dbStatus.error}`
            }
          />
          <Component
            name="Workers / Crons"
            ok={cronStatus.ok}
            detail={
              cronStatus.failures > 0
                ? `${cronStatus.failures} falhas nas últimas 24h de ${cronStatus.recentRuns} execuções`
                : `${cronStatus.recentRuns} execuções nas últimas 24h, todas OK`
            }
          />
        </section>

        <p
          style={{
            marginTop: 32,
            fontSize: 11,
            color: 'var(--text-dim)',
            textAlign: 'center',
          }}
        >
          Atualizado em {new Date().toLocaleString('pt-BR')}
        </p>
      </div>
    </div>
  )
}

function Component({
  name,
  ok,
  detail,
}: {
  name: string
  ok: boolean
  detail: string
}) {
  return (
    <div
      style={{
        padding: 16,
        background: 'var(--surface-1, rgba(255,255,255,0.02))',
        border: '1px solid var(--border)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: 'var(--text-mute)',
          }}
        >
          {detail}
        </div>
      </div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: ok ? 'var(--success)' : 'var(--danger, #ff5050)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: ok ? 'var(--success)' : 'var(--danger, #ff5050)',
          }}
        />
        {ok ? 'OK' : 'Falha'}
      </div>
    </div>
  )
}
