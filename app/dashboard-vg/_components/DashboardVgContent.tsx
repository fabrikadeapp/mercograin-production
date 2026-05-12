'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Plus, Sparkles, ChevronDown } from 'lucide-react'

interface Props {
  fullName: string
  firstName: string
  workspaceName: string
  contratosAbertos: number
  ofertasAtivas: number
}

type Period = 'today' | 'month' | 'date'

interface CommodityRow {
  id: string
  name: string
  symbol: string
  price: number | null
  changePct: number | null
}

function fmtBRL(n: number, fractionDigits = 2): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—'
  const s = n > 0 ? '+' : ''
  return `${s}${n.toFixed(2).replace('.', ',')}%`
}

function colorClass(n: number | null): string {
  if (n === null || n === 0) return 'text-vg-fg-2'
  return n > 0 ? 'text-vg-success' : 'text-vg-destructive'
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function DashboardVgContent({
  fullName,
  firstName,
  workspaceName,
  contratosAbertos,
  ofertasAtivas,
}: Props) {
  const [period, setPeriod] = useState<Period>('month')
  const [commodities, setCommodities] = useState<CommodityRow[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await fetch('/api/cotacoes/commodities?tab=price', { cache: 'no-store' })
        const data = await r.json()
        if (cancelled) return
        setCommodities(data.rows ?? [])
      } catch {
        /* ignore */
      }
    }
    load()
    const id = setInterval(load, 10_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const top4 = commodities
    .filter((c) => ['us_soybeans', 'us_corn', 'us_wheat', 'soybean_meal'].includes(c.id))
    .slice(0, 4)

  return (
    <div className="w-full">
      {/* Grid 12 cols / 2 rows — toda altura útil sem scroll */}
      <div className="grid grid-cols-12 grid-rows-[1fr_1fr] gap-3 h-[calc(100vh-8.5rem)] min-h-[520px]">

        {/* ===== Row 1: Operação | Cotações | Aguardando ===== */}

        {/* Operação ativa */}
        <section className="vg-card col-span-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="text-vg-h3">Operação ativa</div>
            <Link
              href="/contratos"
              className="w-7 h-7 rounded-full inline-flex items-center justify-center hover:bg-vg-card-hover text-vg-fg-2 hover:text-vg-fg"
              aria-label="Ir para contratos"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[22px] font-semibold leading-tight">{workspaceName}</div>
              <div className="text-vg-caption text-vg-fg-2 mt-2">📍 Mesa principal</div>
              <div className="text-vg-caption text-vg-fg-2 mt-0.5">🕒 Sessão ativa</div>
            </div>
            <div className="text-right">
              <div className="text-[32px] font-semibold leading-none tabular-nums">{contratosAbertos}</div>
              <div className="text-vg-caption text-vg-fg-3 mt-1">Contratos abertos</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/contratos/novo" className="vg-btn vg-btn--primary w-full text-[13px] py-2.5">
              <Plus className="w-3.5 h-3.5" /> Novo contrato
            </Link>
            <Link href="/ofertas/nova" className="vg-btn vg-btn--secondary w-full text-[13px] py-2.5">
              Nova oferta
            </Link>
          </div>
        </section>

        {/* Cotações live */}
        <section className="vg-card col-span-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-vg-h3">Cotações ao vivo</div>
              <div className="text-vg-caption text-vg-fg-3 mt-0.5">Atualiza 10s · CBOT/USD</div>
            </div>
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--vg-accent-success)', boxShadow: '0 0 8px var(--vg-accent-success)' }}
              aria-label="ao vivo"
            />
          </div>
          <div className="flex-1 flex flex-col justify-between">
            {top4.length === 0 ? (
              <div className="text-vg-label text-vg-fg-3 text-center my-auto">
                Carregando cotações…
              </div>
            ) : (
              top4.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-vg-fg">{c.name}</div>
                    <div className="text-[10px] text-vg-fg-3 font-mono uppercase tracking-wider">
                      {c.symbol}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[18px] font-semibold tabular-nums leading-tight">
                      {c.price !== null ? fmtBRL(c.price, 2) : '—'}
                    </div>
                    <div className={`text-[11px] font-medium ${colorClass(c.changePct)}`}>
                      {fmtPct(c.changePct)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Aguardando aprovação */}
        <section className="vg-card col-span-3 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-vg-h3">Aguardando</div>
              <div className="text-vg-caption text-vg-fg-3 mt-0.5">
                {ofertasAtivas} ofertas ativas
              </div>
            </div>
            <Link
              href="/ofertas"
              className="w-7 h-7 rounded-full inline-flex items-center justify-center hover:bg-vg-card-hover text-vg-fg-2 hover:text-vg-fg"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex-1 flex flex-col justify-between">
            <ApprovalRow nome="Sementes Horizonte" tipo="Proposta soja" tempo="24 min" />
            <ApprovalRow nome="Cooperativa SP" tipo="Fixação milho" tempo="1d" />
            <ApprovalRow nome="Granaria Verde" tipo="Hedge B3" tempo="2d" />
          </div>
        </section>

        {/* ===== Row 2: Receita | Despesas | Performance | Atalhos ===== */}

        {/* Receita */}
        <section className="vg-card col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="text-vg-h3 text-[15px]">Receita</div>
            <Link
              href="/financeiro"
              className="w-7 h-7 rounded-full inline-flex items-center justify-center hover:bg-vg-card-hover text-vg-fg-2 hover:text-vg-fg"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-vg-success/10 text-vg-success mb-2">
              ↑ +12,4%
            </span>
            <div className="text-[22px] font-semibold tabular-nums leading-tight">
              <span className="text-vg-fg-3 text-[14px] mr-1">R$</span>
              128.000
            </div>
          </div>
        </section>

        {/* Despesas */}
        <section className="vg-card col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="text-vg-h3 text-[15px]">Despesas</div>
            <Link
              href="/financeiro/movimentos"
              className="w-7 h-7 rounded-full inline-flex items-center justify-center hover:bg-vg-card-hover text-vg-fg-2 hover:text-vg-fg"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-vg-destructive/10 text-vg-destructive mb-2">
              ↓ -8,2%
            </span>
            <div className="text-[22px] font-semibold tabular-nums leading-tight">
              <span className="text-vg-fg-3 text-[14px] mr-1">R$</span>
              28.000
            </div>
          </div>
        </section>

        {/* Performance */}
        <section className="vg-card col-span-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-vg-h3">Performance</div>
              <div className="text-vg-caption text-vg-fg-3 mt-0.5">Este mês</div>
            </div>
            <span className="text-vg-caption text-vg-fg-3">2 KPIs</span>
          </div>
          <div className="flex-1 flex flex-col justify-between gap-3">
            <PerfRow label="Volume médio negociado" value="2.450" unit="sc/dia" trend="+8,2%" trendPos />
            <PerfRow label="Lead time fixação" value="3,4" unit="dias" trend="-12%" trendPos />
          </div>
        </section>

        {/* Atalhos */}
        <section className="vg-card col-span-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="text-vg-h3">Atalhos</div>
            <Link
              href="/configuracoes"
              className="w-7 h-7 rounded-full inline-flex items-center justify-center hover:bg-vg-card-hover text-vg-fg-2 hover:text-vg-fg"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            <Link href="/contratos/novo" className="vg-btn vg-btn--primary w-full text-[13px] py-2.5">
              <Plus className="w-3.5 h-3.5" /> Novo contrato
            </Link>
            <Link href="/configuracoes/ai" className="vg-btn vg-btn--secondary w-full text-[13px] py-2.5">
              <Sparkles className="w-3.5 h-3.5" /> Agente AI
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

function ApprovalRow({ nome, tipo, tempo }: { nome: string; tipo: string; tempo: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
        style={{ background: 'var(--vg-accent-primary-muted)', color: 'var(--vg-fg-primary)' }}
      >
        {initials(nome)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-vg-fg truncate leading-tight">{nome}</div>
        <div className="text-[10px] text-vg-fg-3 mt-0.5">
          {tipo} · {tempo}
        </div>
      </div>
      <button
        className="text-[11px] font-semibold px-2.5 py-1 rounded-full hover:opacity-90"
        style={{ background: 'var(--vg-glass-card-hover)', color: 'var(--vg-fg-primary)' }}
      >
        Ver
      </button>
    </div>
  )
}

function PerfRow({
  label,
  value,
  unit,
  trend,
  trendPos,
}: {
  label: string
  value: string
  unit: string
  trend: string
  trendPos: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-vg-fg-3">{label}</span>
        <span
          className={`text-[11px] font-semibold ${trendPos ? 'text-vg-success' : 'text-vg-destructive'}`}
        >
          {trend}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--vg-glass-pill-track)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: trendPos ? '72%' : '28%',
            background: trendPos ? 'var(--vg-accent-primary)' : 'var(--vg-accent-destructive)',
          }}
        />
      </div>
      <div className="flex items-baseline gap-1.5 mt-1.5">
        <span className="text-[22px] font-semibold tabular-nums leading-none">{value}</span>
        <span className="text-[11px] text-vg-fg-3">{unit}</span>
      </div>
    </div>
  )
}
