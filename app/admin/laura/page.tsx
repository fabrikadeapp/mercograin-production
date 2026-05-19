/**
 * Super-admin dashboard de telemetria da Laura.IA.
 *
 * Mostra:
 *  - KPIs: custo total / tokens / mensagens (7d e 30d)
 *  - Distribuição por provider (mensagens + custo)
 *  - Top 10 workspaces por custo (30d)
 *
 * Acesso: protegido pelo guard global em app/admin/layout.tsx
 * (role='admin' + sem WorkspaceMember + 2FA TOTP).
 */
import { db } from '@/lib/db'
import { PageHeader, Card, DenseTable, KPICard } from '@/components/ui/phb'
import { formatMicrosUsd, microsToUsd } from '@/lib/laura/pricing'

export const dynamic = 'force-dynamic'

interface ProviderAgg {
  llmProvider: string | null
  mensagens: bigint
  tokensIn: bigint
  tokensOut: bigint
  custoMicros: bigint
}

interface WorkspaceAgg {
  workspaceId: string
  workspaceNome: string | null
  mensagens: bigint
  tokensIn: bigint
  tokensOut: bigint
  custoMicros: bigint
}

interface PeriodTotals {
  mensagens: number
  tokensIn: number
  tokensOut: number
  custoMicros: number
  latencyAvgMs: number
  erros: number
}

async function loadTotals(sinceDays: number): Promise<PeriodTotals> {
  const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000)
  const rows = await db.$queryRaw<
    Array<{
      mensagens: bigint
      tokens_in: bigint | null
      tokens_out: bigint | null
      custo_micros: bigint | null
      latency_avg: number | null
      erros: bigint
    }>
  >`
    SELECT
      COUNT(*)::bigint AS mensagens,
      COALESCE(SUM("tokensIn"), 0)::bigint AS tokens_in,
      COALESCE(SUM("tokensOut"), 0)::bigint AS tokens_out,
      COALESCE(SUM("custoUsdMicros"), 0)::bigint AS custo_micros,
      AVG("latencyMs")::float AS latency_avg,
      COUNT(*) FILTER (WHERE "errorMsg" IS NOT NULL)::bigint AS erros
    FROM "LauraMessage"
    WHERE "createdAt" >= ${since}
      AND "llmProvider" IS NOT NULL
  `
  const r = rows[0]
  return {
    mensagens: Number(r?.mensagens ?? 0n),
    tokensIn: Number(r?.tokens_in ?? 0n),
    tokensOut: Number(r?.tokens_out ?? 0n),
    custoMicros: Number(r?.custo_micros ?? 0n),
    latencyAvgMs: Math.round(r?.latency_avg ?? 0),
    erros: Number(r?.erros ?? 0n),
  }
}

async function loadByProvider(sinceDays: number): Promise<ProviderAgg[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000)
  return db.$queryRaw<ProviderAgg[]>`
    SELECT
      "llmProvider",
      COUNT(*)::bigint AS mensagens,
      COALESCE(SUM("tokensIn"), 0)::bigint AS "tokensIn",
      COALESCE(SUM("tokensOut"), 0)::bigint AS "tokensOut",
      COALESCE(SUM("custoUsdMicros"), 0)::bigint AS "custoMicros"
    FROM "LauraMessage"
    WHERE "createdAt" >= ${since}
      AND "llmProvider" IS NOT NULL
    GROUP BY "llmProvider"
    ORDER BY mensagens DESC
  `
}

async function loadTopWorkspaces(sinceDays: number): Promise<WorkspaceAgg[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 3600 * 1000)
  return db.$queryRaw<WorkspaceAgg[]>`
    SELECT
      c."workspaceId"        AS "workspaceId",
      w."name"               AS "workspaceNome",
      COUNT(m.*)::bigint     AS mensagens,
      COALESCE(SUM(m."tokensIn"), 0)::bigint   AS "tokensIn",
      COALESCE(SUM(m."tokensOut"), 0)::bigint  AS "tokensOut",
      COALESCE(SUM(m."custoUsdMicros"), 0)::bigint AS "custoMicros"
    FROM "LauraMessage" m
    JOIN "LauraConversation" c ON c.id = m."conversationId"
    LEFT JOIN "Workspace" w ON w.id = c."workspaceId"
    WHERE m."createdAt" >= ${since}
      AND m."llmProvider" IS NOT NULL
    GROUP BY c."workspaceId", w."name"
    ORDER BY "custoMicros" DESC, mensagens DESC
    LIMIT 10
  `
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function pct(part: number, total: number): string {
  if (!total) return '0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

export default async function LauraTelemetryDashboard() {
  const [totals7d, totals30d, providers30d, topWs30d] = await Promise.all([
    loadTotals(7),
    loadTotals(30),
    loadByProvider(30),
    loadTopWorkspaces(30),
  ])

  const totalMsgs30d = providers30d.reduce(
    (s, p) => s + Number(p.mensagens),
    0,
  )
  const totalCusto30d = providers30d.reduce(
    (s, p) => s + Number(p.custoMicros),
    0,
  )

  return (
    <>
      <PageHeader
        eyebrow="ADMIN · LAURA.IA"
        title="Telemetria de uso"
        subtitle="Custo, tokens e providers por mensagem · agregados 7d / 30d"
        search={false}
        showBell={false}
      />

      {/* KPIs 7d */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          eyebrow="MENSAGENS · 7D"
          value={fmtTokens(totals7d.mensagens)}
          subtitle={`${totals7d.erros} com erro`}
        />
        <KPICard
          eyebrow="TOKENS · 7D"
          value={fmtTokens(totals7d.tokensIn + totals7d.tokensOut)}
          subtitle={`${fmtTokens(totals7d.tokensIn)} in · ${fmtTokens(totals7d.tokensOut)} out`}
        />
        <KPICard
          eyebrow="CUSTO · 7D"
          value={formatMicrosUsd(totals7d.custoMicros)}
          subtitle={`média ${totals7d.latencyAvgMs}ms / chamada`}
        />
        <KPICard
          eyebrow="CUSTO · 30D"
          value={formatMicrosUsd(totals30d.custoMicros)}
          subtitle={`${fmtTokens(totals30d.mensagens)} mensagens`}
          highlightValue
        />
      </div>

      {/* Distribuição por provider */}
      <Card className="p-0 mb-6 overflow-hidden">
        <div className="p-4 border-b border-border-1">
          <div className="text-eyebrow text-fg-3 uppercase tracking-wider">
            Distribuição por provider · 30d
          </div>
        </div>
        <DenseTable
          rowKey={(p) => p.llmProvider ?? 'desconhecido'}
          rows={providers30d}
          columns={[
            {
              key: 'provider',
              header: 'Provider',
              accessor: (p) => (
                <span className="font-mono text-small text-fg-1">
                  {p.llmProvider ?? '—'}
                </span>
              ),
            },
            {
              key: 'msgs',
              header: 'Mensagens',
              align: 'right',
              accessor: (p) => (
                <span className="text-fg-1 text-small">
                  {Number(p.mensagens).toLocaleString('pt-BR')}{' '}
                  <span className="text-fg-3 text-micro">
                    ({pct(Number(p.mensagens), totalMsgs30d)})
                  </span>
                </span>
              ),
            },
            {
              key: 'tokensIn',
              header: 'Tokens in',
              align: 'right',
              accessor: (p) => (
                <span className="font-mono text-micro text-fg-2">
                  {fmtTokens(Number(p.tokensIn))}
                </span>
              ),
            },
            {
              key: 'tokensOut',
              header: 'Tokens out',
              align: 'right',
              accessor: (p) => (
                <span className="font-mono text-micro text-fg-2">
                  {fmtTokens(Number(p.tokensOut))}
                </span>
              ),
            },
            {
              key: 'custo',
              header: 'Custo (USD)',
              align: 'right',
              accessor: (p) => (
                <span className="text-fg-1 text-small">
                  {formatMicrosUsd(Number(p.custoMicros))}{' '}
                  <span className="text-fg-3 text-micro">
                    ({pct(Number(p.custoMicros), totalCusto30d)})
                  </span>
                </span>
              ),
            },
          ]}
          empty="Nenhuma chamada LLM registrada nos últimos 30 dias"
        />
      </Card>

      {/* Top workspaces */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border-1">
          <div className="text-eyebrow text-fg-3 uppercase tracking-wider">
            Top 10 workspaces por custo · 30d
          </div>
        </div>
        <DenseTable
          rowKey={(w) => w.workspaceId}
          rows={topWs30d}
          columns={[
            {
              key: 'ws',
              header: 'Workspace',
              accessor: (w) => (
                <span className="text-fg-1 text-small">
                  {w.workspaceNome ?? (
                    <span className="text-fg-3 italic">(sem nome)</span>
                  )}{' '}
                  <span className="font-mono text-micro text-fg-3">
                    {w.workspaceId.slice(0, 8)}
                  </span>
                </span>
              ),
            },
            {
              key: 'msgs',
              header: 'Mensagens',
              align: 'right',
              accessor: (w) => (
                <span className="text-fg-1 text-small">
                  {Number(w.mensagens).toLocaleString('pt-BR')}
                </span>
              ),
            },
            {
              key: 'tokens',
              header: 'Tokens',
              align: 'right',
              accessor: (w) => (
                <span className="font-mono text-micro text-fg-2">
                  {fmtTokens(Number(w.tokensIn) + Number(w.tokensOut))}
                </span>
              ),
            },
            {
              key: 'custo',
              header: 'Custo (USD)',
              align: 'right',
              accessor: (w) => (
                <span className="text-fg-1 text-small">
                  {formatMicrosUsd(Number(w.custoMicros))}
                </span>
              ),
            },
          ]}
          empty="Nenhum workspace consumiu Laura.IA nos últimos 30 dias"
        />
      </Card>

      <div className="mt-6 text-micro text-fg-3">
        Custo total acumulado 30d:{' '}
        <span className="font-mono text-fg-1">
          ${microsToUsd(totals30d.custoMicros).toFixed(6)}
        </span>{' '}
        · groq sempre $0 (free tier) · openrouter free models custam $0 quando
        provider devolve <code>usage.cost = 0</code>
      </div>
    </>
  )
}
