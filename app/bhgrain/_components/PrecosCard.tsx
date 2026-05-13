'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { GlassCard, Badge, Skeleton, ErrorState, EmptyState, fmtBRL, fmtPct, useJson } from './_shared'

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
            <tr className="text-vg-fg-3 text-left">
              <th className="font-normal pb-1.5">Produto</th>
              <th className="font-normal pb-1.5 text-right">Spot (R$/sc)</th>
              <th className="font-normal pb-1.5 text-right">Futuro (R$/sc)</th>
            </tr>
          </thead>
          <tbody>
            {data.grains.map((g) => {
              const min = ageMinutes(g.spot.capturadaEm)
              const ss = sourceStatus(min)
              return (
                <tr key={g.grao} className="border-t border-white/5">
                  <td className="py-1.5">
                    <div className="font-medium">{LABEL[g.grao]}</div>
                    <div className="text-[10px] text-vg-fg-3 truncate">
                      {g.spot.fonte} <span className="mx-0.5">·</span>
                      <span
                        style={{
                          color:
                            ss.tone === 'success'
                              ? 'var(--vg-success, #10b981)'
                              : ss.tone === 'warn'
                                ? '#f59e0b'
                                : ss.tone === 'danger'
                                  ? 'var(--vg-destructive, #ef4444)'
                                  : 'var(--vg-fg-3)',
                        }}
                      >
                        {ss.label}
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    <div className="font-semibold">{g.spot.precoBrlSc != null ? fmtBRL(g.spot.precoBrlSc, 2) : '—'}</div>
                    {g.spot.changePct != null && (
                      <div>
                        <Badge tone={g.spot.changePct >= 0 ? 'success' : 'danger'} label={fmtPct(g.spot.changePct, 2)} />
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    <div className="font-semibold">{g.futuro.precoBrlSc != null ? fmtBRL(g.futuro.precoBrlSc, 2) : '—'}</div>
                    <div className="text-[10px] text-vg-fg-3">
                      {g.futuro.vencimento ?? '—'}
                      {g.futuro.changePct != null && (
                        <span className="ml-1" style={{ color: g.futuro.changePct >= 0 ? 'var(--vg-success, #10b981)' : 'var(--vg-destructive, #ef4444)' }}>
                          {fmtPct(g.futuro.changePct, 2)}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {data.usdbrl?.price != null && (
              <tr className="border-t border-white/5">
                <td className="py-1.5">
                  <div className="font-medium text-vg-fg-2">USD/BRL</div>
                  <div className="text-[10px] text-vg-fg-3">{data.usdbrl.fonte ?? '—'}</div>
                </td>
                <td colSpan={2} className="py-1.5 text-right tabular-nums">
                  <span className="font-semibold">R$ {fmtBRL(data.usdbrl.price, 4)}</span>
                  {data.usdbrl.changePct != null && (
                    <span className="ml-2">
                      <Badge tone={data.usdbrl.changePct >= 0 ? 'success' : 'danger'} label={fmtPct(data.usdbrl.changePct, 2)} />
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </GlassCard>
  )
}
