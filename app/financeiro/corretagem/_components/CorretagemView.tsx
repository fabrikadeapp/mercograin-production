'use client'

/**
 * Corretagem — comissão da Merco Grain sobre o negócio (F1-05).
 * Relatório prevista × faturada × recebida com aging/alertas + ações de status.
 */
import { useEffect, useState, useCallback } from 'react'
import { PageHeader, Card, DenseTable, Chip, Skeleton, EmptyState } from '@/components/ui/phb'
import type { DenseTableColumn } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { Receipt, AlertTriangle } from 'lucide-react'

interface Item {
  id: string
  contratoId: string
  regra: string
  status: string
  base: string
  valorContrato: number
  valorComissao: number
  toneladas: number
  valorPorTonelada: number
  quemPaga: string
  valorComprador: number
  valorVendedorPaga: number
  vencimentoEm: string | null
  atrasada: boolean
  diasAtraso: number
}
interface Resp { itens: Item[]; totais: { prevista: number; faturada: number; recebida: number; atrasadas: number; qtdAtrasadas: number } }

function brl(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) }

const STATUS_VARIANT: Record<string, 'neutral' | 'warn' | 'pos' | 'neg'> = {
  prevista: 'neutral', faturada: 'warn', recebida: 'pos', cancelada: 'neg',
}
const QUEMPAGA_LABEL: Record<string, string> = { comprador: 'Comprador', vendedor: 'Vendedor', ambos: 'Ambos' }

export function CorretagemView({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/comissao/corretagem')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  async function acao(id: string, acao: 'faturar' | 'receber' | 'cancelar') {
    setBusy(id)
    try {
      const res = await fetch('/api/comissao/corretagem', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, acao }),
      })
      if (!res.ok) throw new Error('falha')
      toast.success('Status atualizado')
      load()
    } catch { toast.error('Não foi possível atualizar') }
    finally { setBusy(null) }
  }

  const columns: DenseTableColumn<Item>[] = [
    { key: 'contrato', header: 'Contrato', accessor: (r) => <span className="font-mono text-[11px] text-[var(--text-mute)]">{r.contratoId.slice(0, 8)}</span> },
    { key: 'base', header: 'Base', accessor: (r) => r.base === 'por_tonelada' ? <span className="text-[var(--text-mute)]">{brl(r.valorPorTonelada)}/t × {r.toneladas.toLocaleString('pt-BR')}t</span> : <span className="text-[var(--text-mute)]">% sobre {brl(r.valorContrato)}</span> },
    { key: 'paga', header: 'Quem paga', accessor: (r) => <span className="text-[var(--text-mute)]">{QUEMPAGA_LABEL[r.quemPaga] ?? r.quemPaga}{r.quemPaga === 'ambos' ? ` (${brl(r.valorComprador)}/${brl(r.valorVendedorPaga)})` : ''}</span> },
    { key: 'comissao', header: 'Corretagem', align: 'right', accessor: (r) => <span className="font-bold text-[var(--accent)]">{brl(r.valorComissao)}</span> },
    { key: 'venc', header: 'Vencimento', align: 'right', accessor: (r) => r.vencimentoEm ? <span className={r.atrasada ? 'font-semibold text-[var(--danger)]' : ''}>{new Date(r.vencimentoEm).toLocaleDateString('pt-BR')}{r.atrasada ? ` (+${r.diasAtraso}d)` : ''}</span> : '—' },
    { key: 'status', header: 'Status', accessor: (r) => <Chip variant={STATUS_VARIANT[r.status] ?? 'neutral'}>{r.status}</Chip> },
    ...(canEdit ? [{
      key: 'acoes', header: 'Ações', align: 'right' as const, accessor: (r: Item) => (
        <div className="flex justify-end gap-1.5">
          {r.status === 'prevista' && <Acao label="Faturar" disabled={busy === r.id} onClick={() => acao(r.id, 'faturar')} />}
          {r.status === 'faturada' && <Acao label="Receber" disabled={busy === r.id} onClick={() => acao(r.id, 'receber')} primary />}
          {(r.status === 'prevista' || r.status === 'faturada') && <Acao label="✕" disabled={busy === r.id} onClick={() => acao(r.id, 'cancelar')} />}
        </div>
      ),
    }] : []),
  ]

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Financeiro · Corretagem" title="Corretagem" subtitle="Comissão da corretora sobre os negócios — % ou R$/tonelada, quem paga, e ciclo prevista → faturada → recebida." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TotalCard label="Prevista" value={data?.totais.prevista ?? 0} loading={loading} />
        <TotalCard label="Faturada" value={data?.totais.faturada ?? 0} loading={loading} warn />
        <TotalCard label="Recebida" value={data?.totais.recebida ?? 0} loading={loading} accent />
        <TotalCard label={`Atrasadas (${data?.totais.qtdAtrasadas ?? 0})`} value={data?.totais.atrasadas ?? 0} loading={loading} danger />
      </div>

      {!loading && (data?.totais.qtdAtrasadas ?? 0) > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-[var(--danger-soft)] px-4 py-3 text-[13px] text-[var(--danger)]">
          <AlertTriangle size={16} /> {data!.totais.qtdAtrasadas} corretagem(ns) faturada(s) vencida(s) — total {brl(data!.totais.atrasadas)}. Cobre o recebimento.
        </div>
      )}

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="space-y-2 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : (data?.itens.length ?? 0) === 0 ? (
          <EmptyState icon={Receipt} title="Nenhuma corretagem apurada" description="As corretagens aparecem aqui quando contratos são assinados e o cron de apuração roda." />
        ) : (
          <DenseTable columns={columns} rows={data!.itens} rowKey={(r) => r.id} />
        )}
      </Card>
    </div>
  )
}

function TotalCard({ label, value, loading, accent, warn, danger }: { label: string; value: number; loading: boolean; accent?: boolean; warn?: boolean; danger?: boolean }) {
  const color = danger && value > 0 ? 'var(--danger)' : warn ? 'var(--warning)' : accent ? 'var(--accent)' : 'var(--text)'
  return (
    <Card className="p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">{label}</div>
      {loading ? <Skeleton className="mt-2 h-7 w-28" /> : <div className="mt-2 font-mono text-[22px] font-bold tabular-nums" style={{ color }}>{brl(value)}</div>}
    </Card>
  )
}

function Acao({ label, onClick, disabled, primary }: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-[7px] px-2.5 py-1 text-[11.5px] font-semibold disabled:opacity-50 ${primary ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'border border-[var(--border-strong)] text-[var(--text-mute)] hover:text-[var(--text)]'}`}>{label}</button>
  )
}
