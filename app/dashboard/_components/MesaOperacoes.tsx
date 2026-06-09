'use client'

/**
 * Mesa de Operações — dashboard reformulado (EPIC B).
 *
 * Layout (ref: docs/dashboard-final.html):
 *   KPIs (Propostas funil · Contratos funil · Vendido · Cotações ao vivo)
 *   → grid (Fila de ação unificada | Pipeline de propostas em tabela)
 *   → 3 cards (Assinatura · Fixações · Risco)
 *   → rodapé de status (integrações).
 *
 * Todos os dados vêm de endpoints reais (/api/mesa/*, /api/dashboard/stats,
 * /api/propostas, useLiveQuotes). Sem mocks. Loading via Skeleton; erro/vazio
 * via EmptyState.
 */
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader, Card, DenseTable, Badge, Skeleton, EmptyState } from '@/components/ui/phb'
import type { DenseTableColumn } from '@/components/ui/phb'
import { useLiveQuotes } from '@/lib/quotes/useLiveQuotes'
import {
  AlertTriangle,
  FileSignature,
  Lock,
  Plus,
  LayoutGrid,
  ArrowUpRight,
  Inbox,
  MessageCircle,
} from 'lucide-react'

/* ───────────────────────── helpers ───────────────────────── */

function brl(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1000) {
    if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
    return `R$ ${Math.round(n / 1000)}k`
  }
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function ton(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')}k t`
  return `${Math.round(n)} t`
}

function slaClass(horas: number): string {
  if (horas >= 24) return 'text-[var(--danger)]'
  if (horas >= 4) return 'text-[var(--warning)]'
  return 'text-[var(--text-dim)]'
}

function slaLabel(horas: number): string {
  if (horas >= 24) {
    const d = Math.floor(horas / 24)
    const h = horas % 24
    return h ? `${d}d ${h}h` : `${d}d`
  }
  return `${horas}h`
}

const ORIGEM_VARIANT: Record<string, string> = {
  travada: 'cancelado',
  pedido: 'fechado',
  rascunho: 'rascunho',
}
const ORIGEM_LABEL: Record<string, string> = {
  travada: 'Travada',
  pedido: 'Pedido',
  rascunho: 'Rascunho',
}

/* ───────────────────────── tipos ───────────────────────── */

interface FilaItem {
  id: string
  origem: 'pedido' | 'rascunho' | 'travada'
  cliente: string
  resumo: string
  horas: number
  href: string
  acao: string
}
interface PropostaRow {
  id: string
  numero: string
  status: string
  valorTotal: string
  criadaEm: string
  cliente: { nome: string }
}
interface VendidoPeriodo { key: string; label: string; valor: number; toneladas: number }
interface AssinaturaItem { id: string; numero: string; cliente: string; resumo: string; assinaram: number; totalSignatarios: number; prazo: string; prazoHoras: number | null; href: string }
interface FixacaoItem { id: string; cliente: string; resumo: string; janela: string; janelaHoras: number | null; href: string }
interface RiscoItem { id: string; label: string; valorMaximo: number; valorAtual: number; percentUso: number; severidade: string; href: string }
interface IntegracaoItem { integration: string; label: string; status: string; ok: boolean; responseTimeMs: number | null; lastError: string | null }

/* ───────────────────────── fetch hook ───────────────────────── */

function useJson<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const reload = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps])
  useEffect(() => { reload() }, [reload])
  return { data, loading, error, reload }
}

/* ───────────────────────── componente ───────────────────────── */

export function MesaOperacoes({
  firstName,
  workspaceName,
  enabledFeatures,
}: {
  firstName: string
  workspaceName: string
  enabledFeatures: Record<string, boolean>
}) {
  const stats = useJson<{ propostasPorStatus: { status: string; _count: number }[]; contratoPorStatus: { statusAssinatura: string; _count: number }[] }>('/api/dashboard/stats')
  const fila = useJson<{ items: FilaItem[]; counts: { pedido: number; rascunho: number; travada: number } }>('/api/mesa/fila-acao')
  const pipeline = useJson<{ data: PropostaRow[]; total: number }>('/api/propostas?limit=8')
  const vendido = useJson<{ periodos: VendidoPeriodo[] }>('/api/mesa/vendido')
  const assinaturas = useJson<{ items: AssinaturaItem[] }>('/api/mesa/assinaturas')
  const fixacoes = useJson<{ items: FixacaoItem[] }>('/api/mesa/fixacoes')
  const risco = useJson<{ items: RiscoItem[]; alertas: number }>('/api/mesa/risco')
  const integracoes = useJson<{ items: IntegracaoItem[]; resumo: { online: number; total: number } }>('/api/mesa/integracoes')
  const quotes = useLiveQuotes()

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${saudacao}, ${firstName} · ${workspaceName}`}
        title="Mesa de Operações"
        subtitle={
          fila.data
            ? `${fila.data.counts.travada} travada(s) · ${fila.data.counts.pedido} pedido(s) · ${fila.data.counts.rascunho} rascunho(s) aguardando você`
            : 'Carregando filas…'
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href="/propostas/kanban" className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border border-[var(--border-strong)] px-4 py-2 text-sm font-medium text-[var(--text-mute)] transition-colors hover:text-[var(--text)]">
              <LayoutGrid size={15} /> Kanban
            </Link>
            <Link href="/propostas/nova" className="inline-flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)]">
              <Plus size={15} /> Nova proposta
            </Link>
          </div>
        }
      />

      {/* ───── KPIs ───── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FunilKPI title="Propostas" loading={stats.loading} rows={stats.data?.propostasPorStatus?.map((s) => ({ key: s.status, n: s._count })) ?? []} ativosLabel="ativas" />
        <FunilKPI title="Contratos" loading={stats.loading} rows={stats.data?.contratoPorStatus?.map((s) => ({ key: s.statusAssinatura, n: s._count })) ?? []} ativosLabel="ativos" />
        <VendidoKPI loading={vendido.loading} periodos={vendido.data?.periodos ?? []} />
        <CotacoesKPI quotes={quotes.data} loading={quotes.loading} />
      </div>

      {/* ───── fila + pipeline ───── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.05fr]">
        <FilaAcaoCard fila={fila} />
        <PipelineCard pipeline={pipeline} />
      </div>

      {/* ───── assinatura · fixação · risco ───── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AssinaturaCard q={assinaturas} />
        <FixacoesCard q={fixacoes} />
        <RiscoCard q={risco} enabled={enabledFeatures?.hedge !== false} />
      </div>

      {/* ───── inbox resumo ───── */}
      <InboxResumoCard />

      {/* ───── rodapé status ───── */}
      <StatusBar q={integracoes} />
    </div>
  )
}

/* ───────────────────────── KPIs ───────────────────────── */

const FUNIL_COLOR: Record<string, string> = {
  aceita: 'var(--success)', assinado: 'var(--success)',
  enviada: 'var(--warning)', enviado: 'var(--warning)', pendente: 'var(--warning)',
  rascunho: 'var(--info)', em_analise: 'var(--info)', em_negociacao: 'var(--info)',
  recusada: 'var(--danger)', recusado: 'var(--danger)', cancelada: 'var(--danger)', cancelado: 'var(--danger)', expirada: 'var(--danger)',
}
const FUNIL_LABEL: Record<string, string> = {
  aceita: 'Aceitas', assinado: 'Assinados', enviada: 'Enviadas', enviado: 'Enviados',
  pendente: 'Aguardando', rascunho: 'Rascunhos', em_analise: 'Em análise', em_negociacao: 'Em negociação',
  recusada: 'Recusadas', recusado: 'Recusados', cancelada: 'Canceladas', expirada: 'Expiradas',
}

function FunilKPI({ title, rows, ativosLabel, loading }: { title: string; rows: { key: string; n: number }[]; ativosLabel: string; loading: boolean }) {
  const total = rows.reduce((s, r) => s + r.n, 0)
  const top = [...rows].sort((a, b) => b.n - a.n).slice(0, 4)
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">{title}</span>
        <span className="ml-auto rounded-full bg-[color-mix(in_srgb,var(--accent-2)_14%,transparent)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--accent-2)]">{loading ? '—' : `${total} ${ativosLabel}`}</span>
      </div>
      <div className="mt-2 flex flex-1 flex-col justify-between">
        {loading ? <Skeleton className="h-20 w-full" /> : top.length === 0 ? (
          <p className="py-3 text-xs text-[var(--text-dim)]">Sem registros.</p>
        ) : top.map((r) => (
          <div key={r.key} className="flex items-center gap-2 py-[3px]">
            <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full" style={{ background: FUNIL_COLOR[r.key] ?? 'var(--text-dim)' }} />
            <span className="flex-1 text-[12.5px] text-[var(--text-mute)]">{FUNIL_LABEL[r.key] ?? r.key}</span>
            <span className="font-mono text-[15px] font-bold text-[var(--text)]">{r.n}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function VendidoKPI({ periodos, loading }: { periodos: VendidoPeriodo[]; loading: boolean }) {
  return (
    <Card className="flex flex-col p-4">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">Vendido</span>
      <div className="mt-2 flex flex-1 flex-col justify-between">
        {loading ? <Skeleton className="h-20 w-full" /> : periodos.length === 0 ? (
          <p className="py-3 text-xs text-[var(--text-dim)]">Sem vendas no período.</p>
        ) : periodos.map((p, i) => (
          <div key={p.key} className={`flex items-baseline justify-between gap-2 py-[3px] ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
            <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-dim)]">{p.label}</span>
            <span className={`text-right font-mono font-bold tabular-nums ${i === 0 ? 'text-[17px] text-[var(--accent)]' : 'text-[13.5px] text-[var(--text)]'}`}>
              {brl(p.valor, true)} <em className="not-italic text-[11px] font-medium text-[var(--text-mute)]">· {ton(p.toneladas)}</em>
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function CotacoesKPI({ quotes, loading }: { quotes: any; loading: boolean }) {
  const rows = quotes
    ? [
        { sym: 'SOJA', d: quotes.soja, color: 'var(--grain-soja)' },
        { sym: 'MILHO', d: quotes.milho, color: 'var(--grain-milho)' },
        { sym: 'TRIGO', d: quotes.trigo, color: 'var(--grain-trigo)' },
        { sym: 'USD', d: quotes.usdbrl, color: 'var(--grain-usd)' },
      ]
    : []
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">Cotações</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--success)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" /> ao vivo
        </span>
      </div>
      <div className="mt-2 flex flex-1 flex-col justify-between">
        {loading && !quotes ? <Skeleton className="h-20 w-full" /> : rows.map((r, i) => {
          const price = r.d?.price
          const chg = r.d?.changePct
          const up = (chg ?? 0) >= 0
          return (
            <div key={r.sym} className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 py-[3px] ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}>
              <span className="rounded-[5px] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold" style={{ color: r.color, background: `color-mix(in srgb, ${r.color} 15%, transparent)` }}>{r.sym}</span>
              <span className="text-right font-mono text-[13px] font-semibold tabular-nums text-[var(--text)]">{price != null ? `R$ ${Number(price).toFixed(2).replace('.', ',')}` : '—'}</span>
              <span className={`min-w-[52px] text-right font-mono text-[10.5px] font-semibold tabular-nums ${up ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>{chg != null ? `${up ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}%` : '—'}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ───────────────────────── Fila de ação ───────────────────────── */

function FilaAcaoCard({ fila }: { fila: ReturnType<typeof useJson<{ items: FilaItem[]; counts: any }>> }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-[18px] py-[15px]">
        <h3 className="flex items-center gap-2 text-[14.5px] font-semibold text-[var(--text)]">
          Fila de ação
          {fila.data && <span className="rounded-full bg-[color-mix(in_srgb,var(--accent-2)_14%,transparent)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--accent-2)]">{fila.data.items.length}</span>}
        </h3>
        <span className="font-mono text-[11px] text-[var(--text-dim)]">por urgência</span>
      </div>
      {fila.loading ? (
        <div className="space-y-2 p-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
      ) : fila.error ? (
        <div className="p-4"><EmptyState icon={AlertTriangle} title="Não foi possível carregar a fila" description="Tente recarregar." /><button onClick={fila.reload} className="mt-2 w-full text-sm text-[var(--accent-2)]">Recarregar</button></div>
      ) : (fila.data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={Inbox} title="Fila vazia" description="Nenhuma ação pendente. Bom trabalho!" />
      ) : (
        fila.data!.items.map((it) => (
          <div key={`${it.origem}-${it.id}`} className="flex items-center gap-3 border-t border-[var(--border)] px-[18px] py-3 first:border-t-0">
            <div className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-[9px] text-[12px] font-bold" style={{ background: 'var(--surface-2)', color: 'var(--text-mute)' }}>
              {it.cliente.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text)]">
                <span className="rounded-[5px] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide" style={varForOrigem(it.origem)}>{ORIGEM_LABEL[it.origem]}</span>
                <span className="truncate">{it.cliente}</span>
              </div>
              <div className="mt-1 truncate font-mono text-[11.5px] text-[var(--text-mute)]">{it.resumo}</div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-3">
              <span className={`font-mono text-[11px] font-semibold ${slaClass(it.horas)}`}>{slaLabel(it.horas)}</span>
              <Link href={it.href} className="rounded-[8px] bg-[var(--accent)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--accent-ink)]">{it.acao}</Link>
            </div>
          </div>
        ))
      )}
    </Card>
  )
}

function varForOrigem(origem: string): React.CSSProperties {
  const map: Record<string, [string, string]> = {
    travada: ['var(--danger)', 'var(--danger-soft)'],
    pedido: ['var(--info)', 'var(--info-soft)'],
    rascunho: ['var(--warning)', 'var(--warning-soft)'],
  }
  const [color, bg] = map[origem] ?? ['var(--text-mute)', 'var(--surface-2)']
  return { color, background: bg }
}

/* ───────────────────────── Pipeline ───────────────────────── */

const PROP_STATUS: Record<string, string> = {
  aceita: 'fechado', enviada: 'em-negociacao', rascunho: 'rascunho', recusada: 'cancelado', expirada: 'cancelado', cancelada: 'cancelado',
}

function PipelineCard({ pipeline }: { pipeline: ReturnType<typeof useJson<{ data: PropostaRow[]; total: number }>> }) {
  const columns: DenseTableColumn<PropostaRow>[] = [
    { key: 'cliente', header: 'Cliente', accessor: (r) => (
      <div>
        <div className="font-semibold text-[var(--text)]">{r.cliente?.nome ?? '—'}</div>
        <div className="font-mono text-[10.5px] text-[var(--text-mute)]">{r.numero}</div>
      </div>
    ) },
    { key: 'valor', header: 'Valor', align: 'right', accessor: (r) => brl(Number(r.valorTotal)) },
    { key: 'data', header: 'Criada', align: 'right', accessor: (r) => new Date(r.criadaEm).toLocaleDateString('pt-BR') },
    { key: 'status', header: 'Status', accessor: (r) => <Badge variant={PROP_STATUS[r.status] ?? r.status} /> },
  ]
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-[18px] py-[15px]">
        <h3 className="flex items-center gap-2 text-[14.5px] font-semibold text-[var(--text)]">
          Pipeline de propostas
          {pipeline.data && <span className="rounded-full bg-[color-mix(in_srgb,var(--accent-2)_14%,transparent)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--accent-2)]">{pipeline.data.total}</span>}
        </h3>
        <Link href="/propostas/kanban" className="text-[12px] font-medium text-[var(--accent-2)]">Abrir Kanban →</Link>
      </div>
      {pipeline.loading ? (
        <div className="space-y-2 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : (pipeline.data?.data.length ?? 0) === 0 ? (
        <EmptyState icon={Inbox} title="Sem propostas" description="Crie a primeira proposta para começar." />
      ) : (
        <DenseTable columns={columns} rows={pipeline.data!.data} rowKey={(r) => r.id} />
      )}
    </Card>
  )
}

/* ───────────────────────── 3 cards filas ───────────────────────── */

function MiniCard({ title, count, link, href, children }: { title: string; count?: React.ReactNode; link?: string; href?: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-[18px] py-[14px]">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]">{title}{count}</h3>
        {link && href && <Link href={href} className="text-[12px] font-medium text-[var(--accent-2)]">{link}</Link>}
      </div>
      {children}
    </Card>
  )
}

function AssinaturaCard({ q }: { q: ReturnType<typeof useJson<{ items: AssinaturaItem[] }>> }) {
  return (
    <MiniCard title="Assinatura pendente" href="/contratos" link="Contratos →" count={q.data && <Cnt n={q.data.items.length} />}>
      {q.loading ? <SkeRows /> : (q.data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={FileSignature} title="Nada pendente" description="Sem contratos aguardando assinatura." />
      ) : q.data!.items.slice(0, 4).map((it) => (
        <MiniRow key={it.id} href={it.href} icon={<FileSignature size={15} />} iconColor={it.prazoHoras != null && it.prazoHoras < 24 ? 'danger' : 'warning'}
          title={`${it.cliente} · ${it.numero}`} sub={`${it.resumo || 'Contrato'} · ${it.assinaram}/${it.totalSignatarios || '?'} assinou`}
          right={<span className={`font-mono text-[12.5px] font-bold ${it.prazoHoras != null && it.prazoHoras < 24 ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}>{it.prazo}</span>} />
      ))}
    </MiniCard>
  )
}

function FixacoesCard({ q }: { q: ReturnType<typeof useJson<{ items: FixacaoItem[] }>> }) {
  return (
    <MiniCard title="Fixações de preço" href="/contratos" link="Contratos →" count={q.data && <Cnt n={q.data.items.length} />}>
      {q.loading ? <SkeRows /> : (q.data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={Lock} title="Nada a fixar" description="Sem fixações pendentes na janela." />
      ) : q.data!.items.slice(0, 4).map((it) => (
        <MiniRow key={it.id} href={it.href} icon={<Lock size={15} />} iconColor={it.janelaHoras != null && it.janelaHoras < 24 ? 'danger' : 'accent'}
          title={it.cliente} sub={it.resumo}
          right={<span className={`font-mono text-[12.5px] font-bold ${it.janelaHoras != null && it.janelaHoras < 24 ? 'text-[var(--danger)]' : it.janelaHoras != null && it.janelaHoras < 72 ? 'text-[var(--warning)]' : 'text-[var(--text)]'}`}>{it.janela}</span>} />
      ))}
    </MiniCard>
  )
}

function RiscoCard({ q, enabled }: { q: ReturnType<typeof useJson<{ items: RiscoItem[]; alertas: number }>>; enabled: boolean }) {
  if (!enabled) {
    return (
      <MiniCard title="Risco & limites">
        <EmptyState icon={AlertTriangle} title="Módulo de risco inativo" description="Ative o módulo de hedge/risco nas configurações." />
      </MiniCard>
    )
  }
  return (
    <MiniCard title="Risco & limites" href="/risco" link="Painel →"
      count={q.data ? (q.data.alertas > 0 ? <span className="rounded-full bg-[var(--danger-soft)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--danger)]">{q.data.alertas} alertas</span> : <Cnt n={q.data.items.length} />) : undefined}>
      {q.loading ? <SkeRows /> : (q.data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={AlertTriangle} title="Sem limites" description="Nenhum limite de risco configurado." />
      ) : q.data!.items.slice(0, 3).map((it) => {
        const sevColor = it.severidade === 'critico' || it.severidade === 'breach' ? 'var(--danger)' : it.severidade === 'aviso' ? 'var(--warning)' : 'var(--success)'
        return (
          <div key={it.id} className="border-t border-[var(--border)] first:border-t-0">
            <MiniRow href={it.href} icon={<AlertTriangle size={15} />} iconColor={it.severidade === 'aviso' ? 'warning' : it.severidade === 'ok' ? 'success' : 'danger'}
              title={it.label} sub={`${brl(it.valorAtual, true)} / teto ${brl(it.valorMaximo, true)}`}
              right={<span className="font-mono text-[12.5px] font-bold" style={{ color: sevColor }}>{it.percentUso}%</span>} />
            <div className="mx-[16px] mb-3 h-[5px] overflow-hidden rounded-full bg-[var(--border)]">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, it.percentUso)}%`, background: sevColor }} />
            </div>
          </div>
        )
      })}
    </MiniCard>
  )
}

function Cnt({ n }: { n: number }) {
  return <span className="rounded-full bg-[color-mix(in_srgb,var(--accent-2)_14%,transparent)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--accent-2)]">{n}</span>
}
function SkeRows() {
  return <div className="space-y-2 p-4"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
}
function MiniRow({ href, icon, iconColor, title, sub, right }: { href: string; icon: React.ReactNode; iconColor: 'danger' | 'warning' | 'accent' | 'success'; title: string; sub: string; right: React.ReactNode }) {
  const c = { danger: ['var(--danger)', 'var(--danger-soft)'], warning: ['var(--warning)', 'var(--warning-soft)'], accent: ['var(--accent)', 'var(--accent-soft)'], success: ['var(--success)', 'var(--success-soft)'] }[iconColor]
  return (
    <Link href={href} className="flex items-center gap-3 border-t border-[var(--border)] px-[16px] py-[11px] first:border-t-0 hover:bg-[var(--row-hover)]">
      <span className="grid h-[30px] w-[30px] flex-shrink-0 place-items-center rounded-[8px]" style={{ color: c[0], background: c[1] }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-semibold text-[var(--text)]">{title}</div>
        <div className="truncate font-mono text-[11px] text-[var(--text-mute)]">{sub}</div>
      </div>
      <div className="flex-shrink-0 text-right">{right}</div>
    </Link>
  )
}

/* ───────────────────────── rodapé status ───────────────────────── */

interface ConvResumo { id: string; channel: string; contactName: string | null; lastMessageText: string | null; aiStatus: string; unreadCount: number; clienteId: string | null }
function InboxResumoCard() {
  const inbox = useJson<{ conversations: ConvResumo[] }>('/api/inbox?limit=5')
  const convs = inbox.data?.conversations ?? []
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-[18px] py-[14px]">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]"><MessageCircle size={15} /> Inbox unificado</h3>
        <Link href="/inbox" className="text-[12px] font-medium text-[var(--accent-2)]">Abrir inbox →</Link>
      </div>
      {inbox.loading ? (
        <div className="space-y-2 p-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
      ) : convs.length === 0 ? (
        <EmptyState icon={Inbox} title="Sem mensagens" description="Conversas de WhatsApp/e-mail/portal aparecem aqui." />
      ) : convs.map((c) => (
        <Link key={c.id} href="/inbox" className="flex items-center gap-3 border-t border-[var(--border)] px-[18px] py-2.5 first:border-t-0 hover:bg-[var(--row-hover)]">
          <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--text-mute)]"><MessageCircle size={14} /></div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold text-[var(--text)]">{c.contactName || 'Contato'}</div>
            <div className="truncate text-[11px] text-[var(--text-mute)]">{c.lastMessageText || '—'}</div>
          </div>
          {c.aiStatus === 'pronta_para_proposta' && <span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[9.5px] font-semibold text-[var(--success)]">pronta</span>}
          {c.unreadCount > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold text-white">{c.unreadCount}</span>}
        </Link>
      ))}
    </Card>
  )
}

function StatusBar({ q }: { q: ReturnType<typeof useJson<{ items: IntegracaoItem[]; resumo: { online: number; total: number } }>> }) {
  return (
    <Card className="flex items-center gap-4 overflow-x-auto px-4 py-2.5">
      {q.loading ? <Skeleton className="h-5 w-64" /> : (q.data?.items.length ?? 0) === 0 ? (
        <span className="text-[12px] text-[var(--text-dim)]">Sem integrações monitoradas.</span>
      ) : (
        <>
          {q.data!.items.map((it) => (
            <span key={it.integration} className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-[var(--text-mute)]">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: it.ok ? 'var(--success)' : it.status === 'desconectada' ? 'var(--text-dim)' : 'var(--warning)' }} />
              {it.label}
              <small className="font-mono text-[10.5px] text-[var(--text-dim)]">{it.responseTimeMs != null ? `${it.responseTimeMs}ms` : it.status}</small>
            </span>
          ))}
          <span className="ml-auto inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-[var(--text-mute)]">
            <span className="h-[7px] w-[7px] rounded-full bg-[var(--success)]" />
            {q.data!.resumo.online}/{q.data!.resumo.total} integrações ok
            <ArrowUpRight size={13} />
          </span>
        </>
      )}
    </Card>
  )
}
