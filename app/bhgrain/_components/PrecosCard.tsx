'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { GlassCard, Badge, Skeleton, ErrorState, EmptyState, fmtBRL, fmtPct, useJson } from './_shared'
import { Cotacao, UnidadeSelector, CotacoesFooterNote } from '@/components/ui/cotacoes'
import type { Grao } from '@/lib/cotacoes/unidades'

interface PrecoCombinado {
  grao: 'soja' | 'milho' | 'trigo'
  spot: { precoBrlSc: number | null; fonte: string; capturadaEm: string | null; changePct: number | null }
  futuro: { precoBrlSc: number | null; precoUsdBu: number | null; vencimento: string | null; fonte: string; changePct: number | null }
}

interface Resp {
  grains: PrecoCombinado[]
  usdbrl: { price: number | null; changePct: number | null; fonte: string | null; capturadaEm: string | null }
  marketStates: { ptax: string; cbot: string }
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

export function PrecosCard() {
  // Polling 60s — equilibra frescor com economia de quota Yahoo.
  // Endpoint mantém TTL 30s interno + Cache-Control 30s edge → polling
  // do client geralmente serve do cache, evitando rate limit no Yahoo.
  const { data, error, loading } = useJson<Resp>('/api/bhgrain/precos', [], { pollMs: 60_000 })

  return (
    <GlassCard
      title="Preços ao vivo"
      subtitle="Spot CEPEA + Futuro CBOT"
      status={{ online: !error, label: error ? 'Erro' : 'Online' }}
      action={
        <Link href="/precos" className="text-[11px] text-vg-fg-3 hover:text-vg-fg-primary flex items-center gap-1">
          Ver todos <ArrowUpRight className="w-3 h-3" />
        </Link>
      }
    >
      {/* Seletor global de unidade — afeta todo Cotacao na página via localStorage */}
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
      ) : error ? (
        <ErrorState message="Falha ao atualizar preços" />
      ) : !data?.grains || data.grains.length === 0 ? (
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
            {data.grains.map((g) => {
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
                      usdbrl={data.usdbrl?.price ?? null}
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
                      usdbrl={data.usdbrl?.price ?? null}
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
                            color:
                              g.futuro.changePct >= 0 ? 'var(--success)' : 'var(--danger)',
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
            {data.usdbrl?.price != null && (
              <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="py-2">
                  <div className="font-medium" style={{ color: 'var(--text-mute)' }}>
                    USD/BRL
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                    {data.usdbrl.fonte ?? '—'}
                  </div>
                </td>
                <td colSpan={2} className="py-2 text-right tabular-nums">
                  <span className="font-semibold">R$ {fmtBRL(data.usdbrl.price, 4)}</span>
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
                  {data.usdbrl.changePct != null && (
                    <span className="ml-2">
                      <Badge
                        tone={data.usdbrl.changePct >= 0 ? 'success' : 'danger'}
                        label={fmtPct(data.usdbrl.changePct, 2)}
                      />
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <CotacoesFooterNote />
    </GlassCard>
  )
}
