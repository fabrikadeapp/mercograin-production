'use client'

/**
 * Demandas de compra — pedidos de quem quer comprar, estruturados (Oferta tipo=compra).
 * Cards de resumo + tabela tratada. Cada demanda pode ir para o Match (buscar vendedores).
 */
import * as React from 'react'
import Link from 'next/link'
import {
  Card, CardHeader, Tabs, Pill, Button, GrainBadge, Chip,
  DenseTable, EmptyState, Skeleton, ErrorBanner, type DenseTableColumn,
} from '@/components/ui/phb'
import { GitMerge, ShoppingCart } from 'lucide-react'

const FILTERS = [
  { value: 'todos', label: 'Todas' },
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
  { value: 'outros', label: 'Outros' },
]

interface DemandaRow {
  id: string; numero: string; cultura: string; qtdSc: number; precoSc: number; precoMoeda: string
  origem: string | null; destino: string | null; status: string; qualidade: string | null; criadoEm: string
}

async function safeJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json()
}
function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function fmtMoeda(n: number, m: string) { return `${m === 'USD' ? 'US$' : 'R$'} ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function statusVar(s: string): 'pos' | 'warn' | 'neutral' | 'neg' {
  if (s === 'aberta') return 'pos'
  if (s === 'aceita') return 'warn'
  if (/expirada|cancelada/.test(s)) return 'neg'
  return 'neutral'
}
function qualidadeResumo(q: any): string | null {
  if (!q || typeof q !== 'object') return null
  const parts = Object.entries(q).map(([k, v]) => `${k} ${v}`)
  return parts.length ? parts.join(' · ') : null
}

export function DemandasView() {
  const [filter, setFilter] = React.useState('todos')
  const [demandas, setDemandas] = React.useState<any[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancel = false
    safeJson('/api/ofertas?tipo=compra')
      .then((d) => !cancel && setDemandas(d.ofertas || []))
      .catch((e) => !cancel && setError(String(e)))
    return () => { cancel = true }
  }, [])

  if (error) return <ErrorBanner message={error} />

  const rows: DemandaRow[] = (demandas || []).map((o: any) => ({
    id: o.id, numero: o.numero, cultura: (o.cultura || 'soja').toLowerCase(),
    qtdSc: Number(o.qtdSc || 0), precoSc: Number(o.precoSc || 0), precoMoeda: o.precoMoeda || 'BRL',
    origem: o.origem, destino: o.destino, status: o.status, qualidade: qualidadeResumo(o.qualidadeSpec),
    criadoEm: o.createdAt,
  }))
  const abertas = rows.filter((r) => r.status === 'aberta')
  const totalVol = abertas.reduce((s, r) => s + r.qtdSc, 0)

  const filtered = filter === 'todos' ? rows : rows.filter((r) => r.cultura === filter || (filter === 'outros' && !['soja', 'milho', 'trigo'].includes(r.cultura)))

  const cols: DenseTableColumn<DemandaRow>[] = [
    { key: 'numero', header: 'DEMANDA', accessor: (r) => <span className="t-num text-fg-1">{r.numero}</span> },
    { key: 'cultura', header: 'GRÃO', accessor: (r) => <GrainBadge variant={r.cultura as any} /> },
    { key: 'qtd', header: 'VOLUME (SC)', accessor: (r) => <span className="t-num">{fmtNum(r.qtdSc)}</span>, align: 'right', isNumeric: true },
    { key: 'preco', header: 'PREÇO-ALVO', accessor: (r) => <span className="t-num">{r.precoSc ? fmtMoeda(r.precoSc, r.precoMoeda) : 'a mercado'}</span>, align: 'right', isNumeric: true },
    { key: 'rota', header: 'ORIGEM → DESTINO', accessor: (r) => <span className="text-fg-2 text-small">{[r.origem, r.destino].filter(Boolean).join(' → ') || '—'}</span> },
    { key: 'qualidade', header: 'QUALIDADE', accessor: (r) => <span className="font-mono text-[11px] text-[var(--text-dim)]">{r.qualidade || '—'}</span> },
    { key: 'status', header: 'STATUS', accessor: (r) => <Chip variant={statusVar(r.status)}>{r.status}</Chip> },
    {
      key: 'acoes', header: '', align: 'right',
      accessor: () => <Link href="/match" className="text-[12px] font-medium text-[var(--accent-2)]">Buscar vendedores →</Link>,
    },
  ]

  return (
    <div className="space-y-6">
      {/* cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">Demandas abertas</div><div className="mt-2 font-mono text-[24px] font-bold text-[var(--text)]">{demandas ? abertas.length : '—'}</div></Card>
        <Card className="p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">Volume demandado</div><div className="mt-2 font-mono text-[24px] font-bold text-[var(--accent)]">{demandas ? `${fmtNum(totalVol)} sc` : '—'}</div></Card>
        <Card className="p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">Total registradas</div><div className="mt-2 font-mono text-[24px] font-bold text-[var(--text)]">{demandas ? rows.length : '—'}</div></Card>
      </div>

      {/* tabela */}
      <Card className="p-6">
        <CardHeader>
          <Tabs options={FILTERS} value={filter} onChange={setFilter} size="sm" />
          <Pill>Pedidos de compra</Pill>
        </CardHeader>
        {!demandas ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={36} />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Sem demandas de compra" description="Quando um cliente pedir para comprar (WhatsApp, e-mail, telefone…), a demanda estruturada aparece aqui." />
        ) : (
          <DenseTable columns={cols} rows={filtered} rowKey={(r) => r.numero} className="!border-0 !shadow-none !bg-transparent" />
        )}
      </Card>
    </div>
  )
}
