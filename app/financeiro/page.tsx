import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Receipt,
  Building2,
  GitBranch,
  FileText,
  PieChart,
  Wheat,
  Wallet,
} from 'lucide-react'
import { AppShell, PageHeader, Card } from '@/components/ui/phb'
import { getScope } from '@/lib/auth/scope'
import { loadFinanceiroSnapshot } from '@/lib/financeiro/dashboard-snapshot'
import { ReceitaDespesaChart } from './_components/ReceitaDespesaChart'

export const dynamic = 'force-dynamic'

const NATUREZA_LABEL: Record<string, string> = {
  venda_grao: 'Venda grão',
  servico: 'Serviço',
  royalty: 'Royalty',
  comissao: 'Comissão',
  rendimento_financeiro: 'Rendimento',
  outras_receitas: 'Outras receitas',
  compra_grao: 'Compra grão',
  frete: 'Frete',
  armazenagem: 'Armazenagem',
  imposto: 'Imposto',
  pessoal: 'Pessoal',
  manutencao: 'Manutenção',
  outras_despesas: 'Outras despesas',
}

function fmtBRL(n: number, digits = 0): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function fmtCompactBRL(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2).replace('.', ',')}M`
  if (abs >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace('.', ',')}k`
  return `R$ ${fmtBRL(n, 0)}`
}

function pctChange(curr: number, prev: number): { value: number; label: string; up: boolean } | null {
  if (prev === 0) return null
  const v = ((curr - prev) / Math.abs(prev)) * 100
  return {
    value: v,
    label: `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}% vs mês anterior`,
    up: v >= 0,
  }
}

export default async function FinanceiroHub() {
  const session = await auth()
  if (!session) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/onboarding')

  const snap = await loadFinanceiroSnapshot(scope.workspaceId)
  const margemPct = snap.mes.receita > 0 ? (snap.mes.saldo / snap.mes.receita) * 100 : null
  const ticketMedio = snap.mes.movimentosCount > 0
    ? (snap.mes.receita + snap.mes.despesa) / snap.mes.movimentosCount
    : 0

  const deltaReceita = pctChange(snap.mes.receita, snap.mes.receitaPrevMes)
  const deltaDespesa = pctChange(snap.mes.despesa, snap.mes.despesaPrevMes)

  const hoje = new Date()
  const mesLabel = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Financeiro · ${mesLabel.toUpperCase()}`}
        title="Resultado do mês"
        subtitle="Receitas, despesas, conciliação e relatórios em um só lugar."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/financeiro/movimentos/novo?tipo=despesa"
              className="btn"
              style={{ textDecoration: 'none', fontSize: 12 }}
            >
              <ArrowDownRight className="w-3.5 h-3.5" style={{ color: 'var(--danger)' }} />
              Lançar despesa
            </Link>
            <Link
              href="/financeiro/movimentos/novo?tipo=receita"
              className="btn primary"
              style={{ textDecoration: 'none', fontSize: 12 }}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Lançar receita
            </Link>
          </div>
        }
      />

      {/* KPIs principais — 4 colunas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
        <KpiCard
          label="Receita do mês"
          value={fmtCompactBRL(snap.mes.receita)}
          accent
          icon={<ArrowUpRight className="w-3.5 h-3.5" />}
          delta={deltaReceita}
        />
        <KpiCard
          label="Despesas do mês"
          value={fmtCompactBRL(snap.mes.despesa)}
          icon={<ArrowDownRight className="w-3.5 h-3.5" />}
          delta={deltaDespesa ? { ...deltaDespesa, up: !deltaDespesa.up } : null}
        />
        <KpiCard
          label="Resultado"
          value={fmtCompactBRL(snap.mes.saldo)}
          highlight={snap.mes.saldo >= 0 ? 'positive' : 'negative'}
          icon={<Wallet className="w-3.5 h-3.5" />}
        />
        <KpiCard
          label="Margem operacional"
          value={margemPct != null ? `${margemPct.toFixed(1).replace('.', ',')}%` : '—'}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          subtitle={`${snap.mes.movimentosCount} lançamentos`}
        />
      </div>

      {/* Linha 1 — Gráfico + ações rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-semibold">Receita × Despesa</h2>
              <p className="text-xs opacity-60">Últimos 30 dias</p>
            </div>
            <Link
              href="/financeiro/movimentos"
              className="text-[11px]"
              style={{ color: 'var(--text-mute)' }}
            >
              Ver todos os movimentos →
            </Link>
          </div>
          <ReceitaDespesaChart data={snap.serie30d} />
        </Card>

        <Card className="p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Ações rápidas</h2>
            <p className="text-xs opacity-60">Lançar e organizar</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ActionTile
              href="/financeiro/movimentos/novo?tipo=receita"
              icon={<ArrowUpRight className="w-4 h-4" />}
              label="Nova receita"
              accent="success"
            />
            <ActionTile
              href="/financeiro/movimentos/novo?tipo=despesa"
              icon={<ArrowDownRight className="w-4 h-4" />}
              label="Nova despesa"
              accent="danger"
            />
            <ActionTile
              href="/financeiro/movimentos/novo?tipo=transferencia"
              icon={<GitBranch className="w-4 h-4" />}
              label="Transferência"
            />
            <ActionTile
              href="/financeiro/conciliacao"
              icon={<Receipt className="w-4 h-4" />}
              label="Conciliação OFX"
              badge={snap.naoConciliados > 0 ? snap.naoConciliados : undefined}
            />
            <ActionTile
              href="/financeiro/centros-custo"
              icon={<Building2 className="w-4 h-4" />}
              label="Centros de custo"
            />
            <ActionTile
              href="/financeiro/royalties"
              icon={<Wheat className="w-4 h-4" />}
              label="Royalties"
            />
            <ActionTile
              href="/relatorios/dre"
              icon={<FileText className="w-4 h-4" />}
              label="DRE"
            />
            <ActionTile
              href="/relatorios/curva-abc"
              icon={<PieChart className="w-4 h-4" />}
              label="Curva ABC"
            />
          </div>
        </Card>
      </div>

      {/* Linha 2 — Últimos movimentos + por natureza */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold">Últimos lançamentos</h2>
              <p className="text-xs opacity-60">Mais recentes primeiro</p>
            </div>
            <Link
              href="/financeiro/movimentos"
              className="text-[11px]"
              style={{ color: 'var(--text-mute)' }}
            >
              Ver todos →
            </Link>
          </div>
          {snap.ultimos.length === 0 ? (
            <p className="text-sm opacity-60 py-4">
              Nenhum movimento ainda. Clique em <strong>Lançar receita</strong> ou{' '}
              <strong>Lançar despesa</strong> acima para começar.
            </p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ color: 'var(--text-dim)' }}>
                  <th className="text-left pb-2 eyebrow">Data</th>
                  <th className="text-left pb-2 eyebrow">Descrição</th>
                  <th className="text-left pb-2 eyebrow">Natureza</th>
                  <th className="text-right pb-2 eyebrow">Valor</th>
                </tr>
              </thead>
              <tbody>
                {snap.ultimos.map((m) => {
                  const isReceita = m.tipo === 'receita'
                  const isDespesa = m.tipo === 'despesa'
                  return (
                    <tr key={m.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2 tabular-nums" style={{ color: 'var(--text-dim)' }}>
                        {new Date(m.data).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </td>
                      <td className="py-2">
                        <div className="font-medium truncate" style={{ maxWidth: 280 }}>
                          {m.descricao}
                        </div>
                        {m.centroCusto && (
                          <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                            {m.centroCusto}
                          </div>
                        )}
                      </td>
                      <td className="py-2">
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 10,
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-mute)',
                          }}
                        >
                          {NATUREZA_LABEL[m.natureza] ?? m.natureza}
                        </span>
                      </td>
                      <td
                        className="py-2 text-right tabular-nums font-semibold"
                        style={{
                          color: isReceita
                            ? 'var(--success)'
                            : isDespesa
                              ? 'var(--danger)'
                              : 'var(--text-mute)',
                        }}
                      >
                        {isDespesa ? '−' : isReceita ? '+' : ''}R$ {fmtBRL(m.valor, 2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold">Por natureza</h2>
            <p className="text-xs opacity-60">Últimos 30 dias</p>
          </div>
          {snap.porNatureza.length === 0 ? (
            <p className="text-sm opacity-60 py-4">Sem dados.</p>
          ) : (
            <ul className="space-y-2">
              {snap.porNatureza.slice(0, 7).map((n) => {
                const maxTotal = snap.porNatureza[0]?.total ?? 1
                const pct = (n.total / maxTotal) * 100
                const isReceita = n.tipo === 'receita'
                return (
                  <li key={`${n.tipo}-${n.natureza}`}>
                    <div className="flex items-baseline justify-between mb-1" style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--text-mute)' }}>
                        {NATUREZA_LABEL[n.natureza] ?? n.natureza}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{
                          color: isReceita ? 'var(--success)' : 'var(--danger)',
                          fontSize: 11,
                        }}
                      >
                        {fmtCompactBRL(n.total)}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: 'var(--surface-3)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: isReceita ? 'var(--success)' : 'var(--danger)',
                          opacity: 0.8,
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  )
}

/* ===========================================================================
 * Pequenos sub-components
 * ===========================================================================
 */

function KpiCard({
  label,
  value,
  subtitle,
  delta,
  accent,
  highlight,
  icon,
}: {
  label: string
  value: string
  subtitle?: string
  delta?: { value: number; label: string; up: boolean } | null
  accent?: boolean
  highlight?: 'positive' | 'negative'
  icon?: React.ReactNode
}) {
  const valueColor =
    highlight === 'positive'
      ? 'var(--success)'
      : highlight === 'negative'
        ? 'var(--danger)'
        : accent
          ? 'var(--accent)'
          : 'var(--text)'

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="eyebrow">{label}</p>
        {icon && <span style={{ color: 'var(--text-dim)' }}>{icon}</span>}
      </div>
      <p
        className="tabular-nums"
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: valueColor,
          fontFamily: 'var(--f-sans)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      {(delta || subtitle) && (
        <p
          className="mt-1"
          style={{
            fontSize: 11,
            color: delta
              ? delta.up
                ? 'var(--success)'
                : 'var(--danger)'
              : 'var(--text-dim)',
          }}
        >
          {delta?.label ?? subtitle}
        </p>
      )}
    </Card>
  )
}

function ActionTile({
  href,
  icon,
  label,
  accent,
  badge,
}: {
  href: string
  icon: React.ReactNode
  label: string
  accent?: 'success' | 'danger'
  badge?: number
}) {
  const iconColor =
    accent === 'success'
      ? 'var(--success)'
      : accent === 'danger'
        ? 'var(--danger)'
        : 'var(--text-mute)'
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 'var(--r-md)',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        textDecoration: 'none',
        color: 'var(--text)',
        minHeight: 76,
        transition: '120ms ease',
        position: 'relative',
      }}
      className="hover:border-accent"
    >
      <span style={{ color: iconColor }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
      {badge !== undefined && (
        <span
          className="tabular-nums"
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            minWidth: 16,
            height: 16,
            padding: '0 5px',
            borderRadius: 999,
            background: 'var(--warning)',
            color: '#000',
            fontSize: 9,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={`${badge} pendência${badge === 1 ? '' : 's'}`}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  )
}
