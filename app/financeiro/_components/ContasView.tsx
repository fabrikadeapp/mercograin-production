'use client'

/**
 * ContasView — tela de Contas a Receber / a Pagar.
 *
 * Reutilizada por /financeiro/receber (tipo=receita) e /financeiro/pagar
 * (tipo=despesa). Consome /api/financeiro/contas. Mostra totais (vencido /
 * a vencer / total) + tabela de lançamentos em aberto.
 */
import { useEffect, useState } from 'react'
import { PageHeader, Card, DenseTable, Chip, Skeleton, EmptyState } from '@/components/ui/phb'
import type { DenseTableColumn } from '@/components/ui/phb'
import { Wallet } from 'lucide-react'

interface Conta {
  id: string
  descricao: string
  valor: number
  data: string
  vencido: boolean
  fonte: string
  cliente: string | null
  contrato: string | null
}
interface Resp {
  totais: { vencido: number; aVencer: number; total: number }
  itens: Conta[]
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ContasView({ tipo }: { tipo: 'receita' | 'despesa' }) {
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const receber = tipo === 'receita'

  useEffect(() => {
    setLoading(true)
    fetch(`/api/financeiro/contas?tipo=${tipo}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [tipo])

  const columns: DenseTableColumn<Conta>[] = [
    {
      key: 'desc',
      header: receber ? 'Recebível' : 'Conta',
      accessor: (r) => (
        <div>
          <div className="font-semibold text-[var(--text)]">{r.descricao}</div>
          {(r.cliente || r.contrato) && (
            <div className="font-mono text-[10.5px] text-[var(--text-mute)]">
              {[r.cliente, r.contrato].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      ),
    },
    { key: 'fonte', header: 'Origem', accessor: (r) => <span className="capitalize text-[var(--text-mute)]">{r.fonte}</span> },
    { key: 'venc', header: 'Vencimento', align: 'right', accessor: (r) => new Date(r.data).toLocaleDateString('pt-BR') },
    { key: 'situacao', header: 'Situação', accessor: (r) => <Chip variant={r.vencido ? 'neg' : 'warn'}>{r.vencido ? 'Vencido' : 'A vencer'}</Chip> },
    { key: 'valor', header: 'Valor', align: 'right', accessor: (r) => <span className="font-semibold">{brl(r.valor)}</span> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Financeiro · ${receber ? 'Recebimentos' : 'Pagamentos'}`}
        title={receber ? 'Contas a Receber' : 'Contas a Pagar'}
        subtitle={receber ? 'Recebíveis em aberto — boletos e lançamentos não conciliados.' : 'Despesas em aberto — lançamentos não conciliados.'}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TotalCard label="Total em aberto" value={data?.totais.total ?? 0} loading={loading} accent />
        <TotalCard label="Vencido" value={data?.totais.vencido ?? 0} loading={loading} danger />
        <TotalCard label="A vencer" value={data?.totais.aVencer ?? 0} loading={loading} />
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="space-y-2 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : (data?.itens.length ?? 0) === 0 ? (
          <EmptyState icon={Wallet} title={receber ? 'Nada a receber' : 'Nada a pagar'} description="Nenhum lançamento em aberto no momento." />
        ) : (
          <DenseTable columns={columns} rows={data!.itens} rowKey={(r) => r.id} />
        )}
      </Card>
    </div>
  )
}

function TotalCard({ label, value, loading, accent, danger }: { label: string; value: number; loading: boolean; accent?: boolean; danger?: boolean }) {
  return (
    <Card className="p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">{label}</div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-32" />
      ) : (
        <div className={`mt-2 font-mono text-[24px] font-bold tabular-nums ${danger && value > 0 ? 'text-[var(--danger)]' : accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
          {brl(value)}
        </div>
      )}
    </Card>
  )
}
