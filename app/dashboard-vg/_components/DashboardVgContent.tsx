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
      <div className="grid grid-cols-12 gap-4">
        {/* ===== Welcome row ===== */}
        <header className="col-span-12 flex items-end justify-between mb-2">
          <div>
            <div className="text-vg-body text-vg-fg-2">Welcome Back,</div>
            <h1 className="text-vg-display-xl">{firstName}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="vg-pill-segment">
              <button
                aria-pressed={period === 'today'}
                className={period === 'today' ? 'is-active' : ''}
                onClick={() => setPeriod('today')}
              >
                Hoje
              </button>
              <button
                aria-pressed={period === 'month'}
                className={period === 'month' ? 'is-active' : ''}
                onClick={() => setPeriod('month')}
              >
                Este mês
              </button>
              <button
                aria-pressed={period === 'date'}
                className={period === 'date' ? 'is-active' : ''}
                onClick={() => setPeriod('date')}
              >
                <ChevronDown className="w-3.5 h-3.5" /> Data
              </button>
            </div>
            <div className="vg-avatar w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm"
                 style={{ background: 'var(--vg-accent-primary-muted)', border: '1px solid var(--vg-glass-card-border)' }}>
              {initials(fullName)}
            </div>
          </div>
        </header>

        {/* ===== Hero: Mark mesa / Quick stats / Approvals ===== */}
        <section className="vg-card vg-card--lg col-span-12 md:col-span-5 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <div className="text-vg-h3">Operação ativa</div>
            <Link
              href="/contratos"
              className="w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-vg-card-hover text-vg-fg-2 hover:text-vg-fg"
              aria-label="Ir para contratos"
            >
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-vg-h2 mb-2">{workspaceName}</div>
              <div className="text-vg-label text-vg-fg-2">📍 Mesa principal</div>
              <div className="text-vg-label text-vg-fg-2 mt-1">🕒 Sessão ativa</div>
            </div>
            <div className="text-right">
              <div className="vg-metric tabular-nums">{contratosAbertos}</div>
              <div className="text-vg-caption text-vg-fg-3 mt-1">Contratos abertos</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/contratos/novo"
              className="vg-btn vg-btn--primary w-full"
            >
              <Plus className="w-4 h-4" /> Novo contrato
            </Link>
            <Link
              href="/ofertas/nova"
              className="vg-btn vg-btn--secondary w-full"
            >
              Nova oferta
            </Link>
          </div>
        </section>

        {/* ===== Cotações live ===== */}
        <section className="vg-card col-span-12 md:col-span-4 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-vg-h3">Cotações ao vivo</div>
              <div className="text-vg-caption text-vg-fg-3 mt-0.5">Atualiza a cada 10s</div>
            </div>
            <span className="text-vg-caption text-vg-fg-3">CBOT/USD</span>
          </div>
          <div className="space-y-3">
            {top4.length === 0 ? (
              <div className="text-vg-label text-vg-fg-3 py-8 text-center">
                Carregando cotações…
              </div>
            ) : (
              top4.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-vg-label text-vg-fg">{c.name}</div>
                    <div className="text-vg-caption text-vg-fg-3 font-mono">{c.symbol}</div>
                  </div>
                  <div className="text-right">
                    <div className="vg-metric tabular-nums">
                      {c.price !== null ? fmtBRL(c.price, 2) : '—'}
                    </div>
                    <div className={`text-vg-caption ${colorClass(c.changePct)}`}>
                      {fmtPct(c.changePct)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ===== Aguardando ===== */}
        <section className="vg-card col-span-12 md:col-span-3 min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-vg-h3">Aguardando</div>
              <div className="text-vg-caption text-vg-fg-3 mt-0.5">
                {ofertasAtivas} ofertas ativas
              </div>
            </div>
            <Link
              href="/ofertas"
              className="w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-vg-card-hover text-vg-fg-2 hover:text-vg-fg"
            >
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            <ApprovalRow nome="Sementes Horizonte" tipo="Proposta soja" tempo="24 min" />
            <ApprovalRow nome="Cooperativa SP" tipo="Fixação milho" tempo="1d" />
            <ApprovalRow nome="Granaria Verde" tipo="Hedge B3" tempo="2d" />
          </div>
        </section>

        {/* ===== Receita ===== */}
        <section className="vg-card col-span-6 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-vg-h3 text-base">Receita</div>
            <Link
              href="/financeiro"
              className="w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-vg-card-hover text-vg-fg-2 hover:text-vg-fg"
            >
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-vg-success/10 text-vg-success">
              ↑ +12,4%
            </span>
          </div>
          <div className="vg-metric tabular-nums">
            <span className="text-vg-fg-3 mr-1">R$</span>
            128.000,00
          </div>
        </section>

        {/* ===== Despesas ===== */}
        <section className="vg-card col-span-6 md:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-vg-h3 text-base">Despesas</div>
            <Link
              href="/financeiro/movimentos"
              className="w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-vg-card-hover text-vg-fg-2 hover:text-vg-fg"
            >
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-vg-destructive/10 text-vg-destructive">
              ↓ -8,2%
            </span>
          </div>
          <div className="vg-metric tabular-nums">
            <span className="text-vg-fg-3 mr-1">R$</span>
            28.000,00
          </div>
        </section>

        {/* ===== Performance summary ===== */}
        <section className="vg-card col-span-12 md:col-span-4 min-h-[180px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-vg-h3">Performance</div>
              <div className="text-vg-caption text-vg-fg-3 mt-0.5">Este mês</div>
            </div>
            <button
              className="w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-vg-card-hover text-vg-fg-2 hover:text-vg-fg"
              aria-label="Adicionar KPI"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <PerfRow label="Volume médio negociado" value="2.450" unit="sc/dia" trend="+8,2%" trendPos />
            <PerfRow label="Lead time fixação" value="3,4" unit="dias" trend="-12%" trendPos />
          </div>
        </section>

        {/* ===== Forms / quick action ===== */}
        <section className="vg-card col-span-12 md:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div className="text-vg-h3">Atalhos</div>
            <Link
              href="/configuracoes"
              className="w-8 h-8 rounded-full inline-flex items-center justify-center hover:bg-vg-card-hover text-vg-fg-2 hover:text-vg-fg"
            >
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <Link href="/contratos/novo" className="vg-btn vg-btn--primary w-full mb-2">
            <Plus className="w-4 h-4" /> Novo contrato
          </Link>
          <Link
            href="/configuracoes/ai"
            className="vg-btn vg-btn--secondary w-full"
          >
            <Sparkles className="w-4 h-4" /> Agente AI
          </Link>
        </section>

        {/* ===== Add widget tiles ===== */}
        <button
          className="vg-add-widget col-span-6 md:col-span-2 min-h-[100px]"
          aria-label="Adicionar widget"
        >
          <Plus className="w-6 h-6" />
          <span className="text-vg-label">Adicionar widget</span>
        </button>
        <button
          className="vg-add-widget col-span-6 md:col-span-3 min-h-[100px]"
          aria-label="Adicionar widget"
        >
          <Plus className="w-6 h-6" />
          <span className="text-vg-label">Adicionar widget</span>
        </button>
      </div>

    </div>
  )
}

function ApprovalRow({ nome, tipo, tempo }: { nome: string; tipo: string; tempo: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
        style={{ background: 'var(--vg-accent-primary-muted)', color: 'var(--vg-fg-primary)' }}
      >
        {initials(nome)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-vg-label font-semibold text-vg-fg truncate">{nome}</div>
        <div className="text-vg-caption text-vg-fg-3">
          {tipo} · {tempo}
        </div>
      </div>
      <button
        className="text-[12px] font-semibold px-3 py-1 rounded-full hover:opacity-90"
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
        <span className="text-vg-caption text-vg-fg-3">{label}</span>
        <span
          className={`text-[11px] font-semibold ${trendPos ? 'text-vg-success' : 'text-vg-destructive'}`}
        >
          {trend}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--vg-glass-pill-track)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: trendPos ? '72%' : '28%',
            background: trendPos
              ? 'var(--vg-accent-primary)'
              : 'var(--vg-accent-destructive)',
          }}
        />
      </div>
      <div className="flex items-baseline gap-1.5 mt-2">
        <span className="vg-metric tabular-nums text-2xl">{value}</span>
        <span className="text-vg-caption text-vg-fg-3">{unit}</span>
      </div>
    </div>
  )
}
