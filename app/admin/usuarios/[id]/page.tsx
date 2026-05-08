import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import {
  PageHeader,
  Card,
  KPICard,
  DenseTable,
  Button,
  EmptyState,
} from '@/components/ui/phb'
import { loadPlanMaps } from '@/lib/pricing/maps'
import {
  StatusBadge,
  MoneyValue,
  RelativeTime,
  PlanBadge,
} from '../../_components/atoms'
import { UserActions } from './UserActions'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function UserDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await db.user.findUnique({
    where: { id: params.id },
    include: {
      subscription: true,
      _count: {
        select: {
          clientes: true,
          propostas: true,
          contratos: true,
          boletos: true,
        },
      },
    },
  })
  if (!user) return notFound()

  // Métricas pessoais
  const [auditLogs, propostas, contratos, boletosSum, classCount, alertasCount] =
    await Promise.all([
      db.auditLog.findMany({
        where: { userId: user.id },
        orderBy: { criadoEm: 'desc' },
        take: 50,
      }),
      db.proposta.aggregate({
        where: { usuarioId: user.id },
        _sum: { valorTotal: true },
      }),
      db.contrato.count({ where: { usuarioId: user.id } }),
      db.boleto.aggregate({
        where: { usuarioId: user.id, status: 'pago' },
        _sum: { valor: true },
      }),
      db.classificado.count({ where: { autorId: user.id } }),
      db.alertaPreco.count({ where: { userId: user.id } }),
    ])

  // LTV: meses ativo × preço plano (proxy simples)
  const monthsActive = user.subscription?.createdAt
    ? Math.max(
        1,
        Math.floor(
          (Date.now() - user.subscription.createdAt.getTime()) /
            (30 * 24 * 3600 * 1000),
        ),
      )
    : 0
  const maps = await loadPlanMaps()
  const planPriceCents = user.subscription?.plan
    ? maps.priceCents[user.subscription.plan] ?? 0
    : 0
  const ltvCents = monthsActive * planPriceCents

  const volumeCents = Math.round(
    Number(propostas._sum.valorTotal ?? 0) * 100,
  )

  return (
    <>
      <PageHeader
        eyebrow={`ADMIN · USUÁRIO`}
        title={user.nome}
        subtitle={user.email}
        search={false}
        showBell={false}
        actions={
          <Link
            href="/admin/usuarios"
            className="text-fg-3 text-small hover:text-fg-1"
          >
            ← Voltar
          </Link>
        }
      />

      {/* Cabeçalho rico */}
      <Card className="p-6 mb-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="h-16 w-16 rounded-pill bg-bg-3 border border-border-2 flex items-center justify-center text-h2 font-semibold text-fg-1 shrink-0">
            {user.nome
              .split(/\s+/)
              .filter(Boolean)
              .map((p) => p[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-fg-1 text-h2 font-semibold">{user.nome}</h2>
              <StatusBadge status={user.subscription?.status} />
              <PlanBadge plan={user.subscription?.plan} />
              {user.role === 'admin' && (
                <span
                  className="px-2 py-0.5 rounded-pill text-micro font-bold uppercase"
                  style={{ background: 'var(--neg)', color: 'var(--accent-ink)' }}
                >
                  Admin
                </span>
              )}
            </div>
            <p className="text-fg-3 text-small">
              {user.email} · Cadastrado em{' '}
              {new Date(user.criadoEm).toLocaleDateString('pt-BR')}
              {user.stripeCustomerId
                ? ` · Stripe ${user.stripeCustomerId}`
                : ''}
            </p>
          </div>
          <UserActions
            userId={user.id}
            hasSubscription={!!user.subscription}
            isCanceled={user.subscription?.status === 'canceled'}
          />
        </div>
      </Card>

      {/* KPIs pessoais */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KPICard
          eyebrow="Lifetime value"
          value={new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(ltvCents / 100)}
          subtitle={`${monthsActive} mês${monthsActive !== 1 ? 'es' : ''} ativo${monthsActive !== 1 ? 's' : ''}`}
          highlightValue
        />
        <KPICard
          eyebrow="Volume negociado"
          value={new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            maximumFractionDigits: 0,
          }).format(volumeCents / 100)}
          subtitle="Soma de propostas"
        />
        <KPICard
          eyebrow="Contratos"
          value={String(contratos)}
          subtitle={`${user._count.propostas} propostas geradas`}
        />
        <KPICard
          eyebrow="Boletos pagos"
          value={new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            maximumFractionDigits: 0,
          }).format(Number(boletosSum._sum.valor ?? 0))}
          subtitle={`${user._count.boletos} boletos no total`}
        />
      </div>

      {/* Tabs simples server-rendered */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Atividade */}
        <Card className="p-5">
          <h3 className="text-fg-1 text-h3 font-semibold mb-4">Atividade</h3>
          {auditLogs.length === 0 ? (
            <EmptyState
              title="Sem atividade registrada"
              description="O usuário ainda não realizou ações que gerem audit log."
            />
          ) : (
            <ul className="space-y-3 max-h-[420px] overflow-y-auto">
              {auditLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-start gap-3 pb-3 border-b border-border-1 last:border-0"
                >
                  <span className="h-2 w-2 rounded-full bg-accent mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-fg-1 text-small">
                      <span className="font-mono uppercase text-micro mr-2 text-fg-3">
                        {log.acao}
                      </span>
                      {log.entidade}
                    </div>
                    <div className="text-fg-3 text-micro">
                      <RelativeTime date={log.criadoEm} />
                      {log.ipAddress ? ` · ${log.ipAddress}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Assinatura */}
        <Card className="p-5">
          <h3 className="text-fg-1 text-h3 font-semibold mb-4">Assinatura</h3>
          {!user.subscription ? (
            <EmptyState
              title="Sem assinatura"
              description="Este usuário ainda não assinou nenhum plano."
            />
          ) : (
            <dl className="space-y-3 text-small">
              <Row label="Plano">
                <PlanBadge plan={user.subscription.plan} />
              </Row>
              <Row label="Status">
                <StatusBadge status={user.subscription.status} />
              </Row>
              <Row label="MRR">
                <MoneyValue cents={planPriceCents} />
              </Row>
              <Row label="Trial">
                {user.subscription.trialEnd
                  ? new Date(user.subscription.trialEnd).toLocaleDateString(
                      'pt-BR',
                    )
                  : '—'}
              </Row>
              <Row label="Próxima cobrança">
                {user.subscription.currentPeriodEnd
                  ? new Date(
                      user.subscription.currentPeriodEnd,
                    ).toLocaleDateString('pt-BR')
                  : '—'}
              </Row>
              <Row label="Cancela ao fim do período">
                {user.subscription.cancelAtPeriodEnd ? 'Sim' : 'Não'}
              </Row>
              <Row label="Stripe Subscription ID">
                <span className="font-mono text-micro text-fg-3">
                  {user.subscription.stripeSubscriptionId}
                </span>
              </Row>
              <Row label="Iniciado em">
                {new Date(user.subscription.createdAt).toLocaleDateString(
                  'pt-BR',
                )}
              </Row>
            </dl>
          )}
        </Card>

        {/* Dados de uso */}
        <Card className="p-5 xl:col-span-2">
          <h3 className="text-fg-1 text-h3 font-semibold mb-4">Dados de uso</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <UsageStat label="Clientes" value={user._count.clientes} />
            <UsageStat label="Propostas" value={user._count.propostas} />
            <UsageStat label="Contratos" value={user._count.contratos} />
            <UsageStat label="Boletos" value={user._count.boletos} />
            <UsageStat label="Classificados" value={classCount} />
            <UsageStat label="Alertas" value={alertasCount} />
          </div>
        </Card>
      </div>
    </>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-fg-3">{label}</dt>
      <dd className="text-fg-1">{children}</dd>
    </div>
  )
}

function UsageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-bg-2 border border-border-1 rounded-md p-4">
      <p className="eyebrow mb-1">{label}</p>
      <p className="t-num-lg text-fg-1">{value}</p>
    </div>
  )
}
