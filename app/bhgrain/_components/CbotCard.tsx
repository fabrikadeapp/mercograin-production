'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { GlassCard, Skeleton, ErrorState, fmtBRL, fmtPct, useJson } from './_shared'
import { Chip } from '@/components/ui/newdb'

type Unidade = 'centsBu' | 'usdBu' | 'brlSc60' | 'brlTon'

interface CbotItem {
  grao: 'soja' | 'milho' | 'trigo'
  nome: string
  vencimento: string | null
  marketState: string | null
  capturadaEm: string | null
  centsBu: number | null
  usdBu: number | null
  brlSc60: number | null
  brlTon: number | null
  changePct: number | null
  changeAbs: number | null
  previousClose: number | null
  highBu: number | null
  lowBu: number | null
  openBu: number | null
}

interface Resp {
  items: CbotItem[]
  usdbrl: {
    price: number | null
    fonte: string
    capturadaEm: string | null
    intraday: boolean
  }
  marketState: string
  fetchedAt: string
}

const UNIDADE_LABEL: Record<Unidade, string> = {
  centsBu: '¢/bu',
  usdBu: 'US$/bu',
  brlSc60: 'R$/sc',
  brlTon: 'R$/t',
}

const UNIDADE_DESC: Record<Unidade, string> = {
  centsBu: 'Nativo CBOT (cents por bushel)',
  usdBu: 'Dólar por bushel',
  brlSc60: 'Real por saca de 60 kg',
  brlTon: 'Real por tonelada',
}

function formatValor(item: CbotItem, unidade: Unidade): string {
  switch (unidade) {
    case 'centsBu':
      return item.centsBu != null ? item.centsBu.toFixed(2) + ' ¢' : '—'
    case 'usdBu':
      return item.usdBu != null ? 'US$ ' + item.usdBu.toFixed(4) : '—'
    case 'brlSc60':
      return item.brlSc60 != null ? fmtBRL(item.brlSc60, 2) : '—'
    case 'brlTon':
      return item.brlTon != null ? fmtBRL(item.brlTon, 2) : '—'
  }
}

function formatRange(item: CbotItem, unidade: Unidade): string {
  if (item.lowBu == null || item.highBu == null) return '—'
  if (unidade === 'centsBu') {
    return `${(item.lowBu * 100).toFixed(1)}¢ – ${(item.highBu * 100).toFixed(1)}¢`
  }
  if (unidade === 'usdBu') {
    return `${item.lowBu.toFixed(2)} – ${item.highBu.toFixed(2)}`
  }
  // Para R$ não temos hi/lo convertido no payload; mostra US$ como referência
  return `${item.lowBu.toFixed(2)} – ${item.highBu.toFixed(2)} US$/bu`
}

function marketStateLabel(s: string | null): string {
  switch (s) {
    case 'REGULAR':
      return 'Em operação'
    case 'PRE':
      return 'Pré-mercado'
    case 'POST':
    case 'POSTPOST':
      return 'After-hours'
    case 'CLOSED':
      return 'Fechado'
    default:
      return s ?? '—'
  }
}

export function CbotCard() {
  const [unidade, setUnidade] = useState<Unidade>('brlSc60')
  const { data, error, loading } = useJson<Resp>('/api/bhgrain/cbot', [], { pollMs: 30_000 })

  return (
    <GlassCard
      title="Chicago CBOT"
      subtitle={`Futuros agrícolas · ${marketStateLabel(data?.marketState ?? null)}`}
      status={{ online: !error, label: error ? 'Erro' : 'Online' }}
      action={
        <Link
          href="/precos"
          className="text-[11px] text-vg-fg-3 hover:text-vg-fg-primary flex items-center gap-1"
        >
          Histórico <ArrowUpRight className="w-3 h-3" />
        </Link>
      }
    >
      {/* Seletor de unidade */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3" title={UNIDADE_DESC[unidade]}>
        {(Object.keys(UNIDADE_LABEL) as Unidade[]).map((u) => (
          <Chip key={u} active={unidade === u} onClick={() => setUnidade(u)}>
            {UNIDADE_LABEL[u]}
          </Chip>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : error || !data?.items ? (
        <ErrorState message="Falha ao buscar Chicago" />
      ) : (
        <>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left" style={{ color: 'var(--text-dim)' }}>
                <th className="font-normal pb-2 eyebrow">Contrato</th>
                <th className="font-normal pb-2 eyebrow text-right">{UNIDADE_LABEL[unidade]}</th>
                <th className="font-normal pb-2 eyebrow text-right">Var. dia</th>
                <th className="font-normal pb-2 eyebrow text-right hidden sm:table-cell">
                  Range (US$/bu)
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const subiu = (item.changePct ?? 0) >= 0
                return (
                  <tr
                    key={item.grao}
                    className="border-t"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="py-2">
                      <div className="font-medium">{item.nome}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                        {item.vencimento ?? '—'}
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      <div className="font-semibold">{formatValor(item, unidade)}</div>
                      {(unidade === 'centsBu' || unidade === 'usdBu') &&
                      item.previousClose != null ? (
                        <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                          ant.{' '}
                          {unidade === 'centsBu'
                            ? `${item.previousClose.toFixed(2)}¢`
                            : `$${(item.previousClose / 100).toFixed(2)}`}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {item.changePct != null ? (
                        <span
                          style={{
                            color: subiu ? 'var(--success)' : 'var(--danger)',
                            fontWeight: 600,
                          }}
                        >
                          {fmtPct(item.changePct, 2)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td
                      className="py-2 text-right tabular-nums hidden sm:table-cell"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      {formatRange(item, unidade)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Linha do USD/BRL */}
          {data.usdbrl?.price != null && (
            <div
              className="mt-3 pt-3 flex items-center justify-between text-[11px]"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Câmbio usado · </span>
                <span style={{ color: data.usdbrl.intraday ? 'var(--success)' : 'var(--warning)' }}>
                  {data.usdbrl.fonte}
                </span>
                {!data.usdbrl.intraday && (
                  <span style={{ color: 'var(--text-dim)' }}> (pode estar desatualizado)</span>
                )}
              </div>
              <div className="font-semibold tabular-nums">
                US$/R$ {data.usdbrl.price.toFixed(4)}
              </div>
            </div>
          )}
        </>
      )}
    </GlassCard>
  )
}
