'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import {
  GlassCard,
  Badge,
  Skeleton,
  ErrorState,
  EmptyState,
  fmtBRL,
  fmtPct,
  useJson,
} from './_shared'
import { Cotacao, UnidadeSelector, CotacoesFooterNote } from '@/components/ui/cotacoes'
import type { Grao } from '@/lib/cotacoes/unidades'

interface PrecoCombinado {
  grao: 'soja' | 'milho' | 'trigo'
  spot: {
    precoBrlSc: number | null
    fonte: string
    capturadaEm: string | null
    changePct: number | null
  }
  futuro: {
    precoBrlSc: number | null
    precoUsdBu: number | null
    vencimento: string | null
    fonte: string
    changePct: number | null
  }
}

interface RespPrecos {
  grains: PrecoCombinado[]
  usdbrl: {
    price: number | null
    changePct: number | null
    fonte: string | null
    capturadaEm: string | null
  }
  marketStates: { ptax: string; cbot: string }
  fetchedAt: string
}

interface CbotItem {
  grao: 'soja' | 'milho' | 'trigo'
  nome: string
  vencimento: string | null
  marketState: string | null
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

interface RespCbot {
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

const LABEL: Record<string, string> = { soja: 'Soja', milho: 'Milho', trigo: 'Trigo' }

function ageMinutes(iso: string | null): number | null {
  if (!iso) return null
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000)
}

function sourceStatus(min: number | null): { label: string; tone: 'success' | 'warn' | 'danger' | 'neutral' } {
  if (min == null) return { label: 'Sem dados', tone: 'neutral' }
  if (min <= 5) return { label: 'Online', tone: 'success' }
  if (min <= 30) return { label: `Atualizado há ${min} min`, tone: 'success' }
  if (min <= 120) return { label: 'Com atraso', tone: 'warn' }
  return { label: 'Desatualizado', tone: 'danger' }
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

type Tab = 'spot' | 'cbot' | 'cambio'

export function PrecosCard() {
  const [tab, setTab] = useState<Tab>('spot')
  const { data: precos, error: errPrecos, loading: loadPrecos } = useJson<RespPrecos>(
    '/api/bhgrain/precos',
    [],
    { pollMs: 60_000 }
  )
  // Dados detalhados CBOT — só busca quando aba Chicago/Câmbio está ativa
  const { data: cbot, error: errCbot, loading: loadCbot } = useJson<RespCbot>(
    tab === 'spot' ? null : '/api/bhgrain/cbot',
    [tab],
    { pollMs: 30_000 }
  )

  const error = tab === 'spot' ? errPrecos : errCbot

  return (
    <GlassCard
      title="Preços ao vivo"
      subtitle="Spot CEPEA + Futuros CBOT + Câmbio"
      status={{ online: !error, label: error ? 'Erro' : 'Online' }}
      action={
        <div className="flex items-center gap-4">
          {/* Tabs minimal */}
          {(['spot', 'cbot', 'cambio'] as Tab[]).map((t) => {
            const active = tab === t
            const label = t === 'spot' ? 'Spot + Futuro' : t === 'cbot' ? 'Chicago' : 'Câmbio'
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="transition"
                style={{
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--text)' : 'var(--text-mute)',
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {label}
              </button>
            )
          })}
          <Link
            href="/precos"
            className="text-[11px] flex items-center gap-1 transition"
            style={{ color: 'var(--text-mute)' }}
          >
            Ver todos <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      }
    >
      {/* Seletor global de unidade */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="eyebrow">Unidade</span>
        <UnidadeSelector />
      </div>

      {/* ABA 1: Spot CEPEA + Futuro CBOT (resumo) */}
      {tab === 'spot' && (
        <>
          {loadPrecos ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : errPrecos ? (
            <ErrorState message="Falha ao atualizar preços" />
          ) : !precos?.grains || precos.grains.length === 0 ? (
            <EmptyState message="Nenhum preço disponível" />
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left" style={{ color: 'var(--text-dim)' }}>
                  <th className="font-normal pb-1.5 eyebrow">Produto</th>
                  <th className="font-normal pb-1.5 eyebrow text-right">Spot</th>
                  <th className="font-normal pb-1.5 eyebrow text-right">Futuro CBOT</th>
                </tr>
              </thead>
              <tbody>
                {precos.grains.map((g) => {
                  const min = ageMinutes(g.spot.capturadaEm)
                  const ss = sourceStatus(min)
                  return (
                    <tr key={g.grao} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2">
                        <div className="font-medium">{LABEL[g.grao]}</div>
                        <div className="text-[10px] truncate" style={{ color: 'var(--text-dim)' }}>
                          {g.spot.fonte} <span className="mx-0.5">·</span>
                          <span
                            style={{
                              color:
                                ss.tone === 'success'
                                  ? 'var(--success)'
                                  : ss.tone === 'warn'
                                    ? 'var(--warning)'
                                    : ss.tone === 'danger'
                                      ? 'var(--danger)'
                                      : 'var(--text-dim)',
                            }}
                          >
                            {ss.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <Cotacao
                          grao={g.grao as Grao}
                          unidadeEntrada="brlSc60"
                          valor={g.spot.precoBrlSc}
                          usdbrl={precos.usdbrl?.price ?? null}
                          fonte={g.spot.fonte}
                          contexto={`Spot ${LABEL[g.grao]}`}
                          size="sm"
                        />
                        {g.spot.changePct != null && (
                          <div className="mt-0.5">
                            <Badge
                              tone={g.spot.changePct >= 0 ? 'success' : 'danger'}
                              label={fmtPct(g.spot.changePct, 2)}
                            />
                          </div>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <Cotacao
                          grao={g.grao as Grao}
                          unidadeEntrada="brlSc60"
                          valor={g.futuro.precoBrlSc}
                          usdbrl={precos.usdbrl?.price ?? null}
                          fonte={`${g.futuro.fonte} · ${g.futuro.vencimento ?? '—'}`}
                          contexto={`Futuro CBOT ${LABEL[g.grao]}`}
                          size="sm"
                        />
                        <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                          {g.futuro.vencimento ?? '—'}
                          {g.futuro.changePct != null && (
                            <span
                              className="ml-1"
                              style={{
                                color: g.futuro.changePct >= 0 ? 'var(--success)' : 'var(--danger)',
                              }}
                            >
                              {fmtPct(g.futuro.changePct, 2)}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* ABA 2: Chicago CBOT detalhado */}
      {tab === 'cbot' && (
        <>
          <div className="text-[10px] mb-2" style={{ color: 'var(--text-dim)' }}>
            {marketStateLabel(cbot?.marketState ?? null)} · contratos próximos · variação intraday
          </div>
          {loadCbot ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : errCbot || !cbot?.items ? (
            <ErrorState message="Falha ao buscar Chicago" />
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left" style={{ color: 'var(--text-dim)' }}>
                  <th className="font-normal pb-2 eyebrow">Contrato</th>
                  <th className="font-normal pb-2 eyebrow text-right">Cotação</th>
                  <th className="font-normal pb-2 eyebrow text-right">Var. dia</th>
                  <th className="font-normal pb-2 eyebrow text-right hidden sm:table-cell">
                    Range US$/bu
                  </th>
                </tr>
              </thead>
              <tbody>
                {cbot.items.map((item) => {
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
                          usdbrl={cbot.usdbrl?.price ?? null}
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
          )}
        </>
      )}

      {/* ABA 3: Câmbio USD/BRL com transparência da fonte */}
      {tab === 'cambio' && (
        <>
          {loadCbot ? (
            <Skeleton className="h-20" />
          ) : errCbot || !cbot?.usdbrl ? (
            <ErrorState message="Falha ao buscar câmbio" />
          ) : cbot.usdbrl.price == null ? (
            <EmptyState message="Câmbio indisponível" />
          ) : (
            <div
              style={{
                padding: 14,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
              }}
            >
              <div className="flex items-baseline justify-between mb-2">
                <div className="eyebrow">USD / BRL</div>
                <span
                  className="badge"
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    background: cbot.usdbrl.intraday ? 'var(--success-soft)' : 'var(--warning-soft)',
                    color: cbot.usdbrl.intraday ? 'var(--success)' : 'var(--warning)',
                    border: `1px solid ${cbot.usdbrl.intraday ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}`,
                    borderRadius: 999,
                  }}
                >
                  {cbot.usdbrl.intraday ? 'Intraday' : 'Fechamento'}
                </span>
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: 'var(--accent)',
                }}
              >
                R$ {cbot.usdbrl.price.toFixed(4)}
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text-mute)',
                    fontFamily: 'var(--f-mono)',
                    marginLeft: 6,
                    fontWeight: 400,
                  }}
                >
                  /US$
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                Fonte: <span style={{ color: 'var(--text-mute)' }}>{cbot.usdbrl.fonte}</span>
                {!cbot.usdbrl.intraday && (
                  <span> · pode estar desatualizado (último fechamento oficial)</span>
                )}
                {cbot.usdbrl.capturadaEm && (
                  <span> · {new Date(cbot.usdbrl.capturadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
            </div>
          )}

          {/* Linha extra do precos endpoint quando tem changePct */}
          {precos?.usdbrl?.price != null && precos.usdbrl.changePct != null && (
            <div
              className="mt-3 flex items-center justify-between text-[11px]"
              style={{ color: 'var(--text-dim)' }}
            >
              <span>Variação dia</span>
              <Badge
                tone={precos.usdbrl.changePct >= 0 ? 'success' : 'danger'}
                label={fmtPct(precos.usdbrl.changePct, 2)}
              />
            </div>
          )}

          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 12 }}>
            <strong style={{ color: 'var(--text-mute)' }}>Prioridade de fontes:</strong>{' '}
            AwesomeAPI (interbancário intraday) → BCB PTAX (oficial, fechamento).
            Para preços convertidos a R$/sc usamos sempre o câmbio mais recente disponível.
          </div>
        </>
      )}

      <CotacoesFooterNote />
    </GlassCard>
  )
}
