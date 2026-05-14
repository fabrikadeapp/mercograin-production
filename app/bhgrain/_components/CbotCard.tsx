'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { GlassCard, Skeleton, ErrorState, fmtPct, useJson } from './_shared'
import { Cotacao, UnidadeSelector, CotacoesFooterNote } from '@/components/ui/cotacoes'
import type { Grao } from '@/lib/cotacoes/unidades'

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
      {/* Seletor global de unidade — sincroniza com outros cards via localStorage */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="eyebrow">Unidade</span>
        <UnidadeSelector />
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
                <th className="font-normal pb-2 eyebrow text-right">Cotação</th>
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
                    <td className="py-2 text-right">
                      <Cotacao
                        grao={item.grao as Grao}
                        unidadeEntrada="brlSc60"
                        valor={item.brlSc60}
                        usdbrl={data.usdbrl?.price ?? null}
                        fonte={`CBOT · ${item.vencimento ?? '—'}`}
                        contexto={`Hi/Lo: ${item.highBu?.toFixed(2) ?? '—'} / ${item.lowBu?.toFixed(2) ?? '—'} US$/bu`}
                        size="sm"
                      />
                      {item.previousClose != null && (
                        <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                          ant. ${(item.previousClose / 100).toFixed(2)}/bu
                        </div>
                      )}
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
                      {item.lowBu != null && item.highBu != null
                        ? `${item.lowBu.toFixed(2)} – ${item.highBu.toFixed(2)}`
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Câmbio USD/BRL — fonte sempre visível */}
          {data.usdbrl?.price != null && (
            <div
              className="mt-3 pt-3 flex items-center justify-between text-[11px]"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Câmbio · </span>
                <span style={{ color: data.usdbrl.intraday ? 'var(--success)' : 'var(--warning)' }}>
                  {data.usdbrl.fonte}
                </span>
                {!data.usdbrl.intraday && (
                  <span style={{ color: 'var(--text-dim)' }}> (fechamento, pode estar defasado)</span>
                )}
              </div>
              <div className="font-semibold tabular-nums">
                <span>R$ {data.usdbrl.price.toFixed(4)}</span>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text-mute)',
                    fontFamily: 'var(--f-mono)',
                    marginLeft: 4,
                  }}
                >
                  /US$
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <CotacoesFooterNote />
    </GlassCard>
  )
}
