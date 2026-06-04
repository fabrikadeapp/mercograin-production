'use client'

import { useEffect, useState } from 'react'
import { Loader2, Trophy, TrendingDown, Clock } from 'lucide-react'
import { GlassCard } from '@/app/bhgrain/_components/_shared'

interface WinLossData {
  janela: { dias: number; desde: string; ate: string }
  resumo: {
    ganhas: number
    perdidas: number
    totalDecididas: number
    hitRate: number
    receitaGanhas: number
    receitaPerdidasEstim: number
    tempoMedioDecisaoHoras: number
  }
  lossReasons: { reason: string; label: string; count: number; valor: number; pct: number }[]
  porCanal: { canal: string; ganhas: number; perdidas: number; receita: number; hitRate: number }[]
  porCommodity: {
    commodity: string
    ganhas: number
    perdidas: number
    receita: number
    hitRate: number
  }[]
  porVendedor: {
    vendedorId: string
    nome: string
    ganhas: number
    perdidas: number
    receita: number
    hitRate: number
  }[]
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`

const corHit = (hit: number): string => {
  if (hit >= 0.6) return 'var(--success)'
  if (hit >= 0.3) return 'var(--warning)'
  return 'var(--danger)'
}

const CANAL_LABEL: Record<string, string> = {
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  web: 'Web',
  ia_autonomo: 'IA autônoma',
}

export function WinLossView() {
  const [data, setData] = useState<WinLossData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dias, setDias] = useState(90)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/propostas/win-loss?dias=${dias}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setData(j as WinLossData)
      })
      .finally(() => setLoading(false))
  }, [dias])

  if (loading || !data) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center" style={{ color: 'var(--text-dim)' }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="pb-2">
        <div className="eyebrow" style={{ marginBottom: 6 }}>COMERCIAL · WIN/LOSS</div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>
              Por que ganhamos e por que perdemos
            </h1>
            <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-mute)' }}>
              Últimos {data.janela.dias} dias · {data.resumo.totalDecididas} propostas decididas
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {[30, 90, 180, 365].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDias(d)}
                className="chip"
                style={{
                  background: dias === d ? 'var(--accent)' : 'var(--surface-2)',
                  color: dias === d ? 'var(--accent-ink)' : 'var(--text-mute)',
                  fontWeight: dias === d ? 600 : 400,
                  padding: '4px 12px',
                  fontSize: 12,
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card icon={<Trophy className="h-4 w-4" />} label="Hit rate" valor={fmtPct(data.resumo.hitRate)} sub={`${data.resumo.ganhas} ganhas / ${data.resumo.perdidas} perdidas`} tom={corHit(data.resumo.hitRate)} />
        <Card icon={<Trophy className="h-4 w-4" />} label="Receita ganha" valor={fmt(data.resumo.receitaGanhas)} sub={`em ${data.resumo.ganhas} propostas`} tom="var(--success)" />
        <Card icon={<TrendingDown className="h-4 w-4" />} label="Receita perdida (estimada)" valor={fmt(data.resumo.receitaPerdidasEstim)} sub={`em ${data.resumo.perdidas} propostas`} tom="var(--danger)" />
        <Card icon={<Clock className="h-4 w-4" />} label="Tempo médio decisão" valor={`${data.resumo.tempoMedioDecisaoHoras.toFixed(1)}h`} sub="da criação ao fechamento" tom="var(--info)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Motivos de perda */}
        <GlassCard title="Motivos de perda" subtitle="Onde estamos sangrando">
          {data.lossReasons.length === 0 ? (
            <p className="text-center py-6" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Sem propostas perdidas com motivo registrado.
            </p>
          ) : (
            <div className="space-y-2">
              {data.lossReasons.map((r) => (
                <div key={r.reason}>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontSize: 13 }}>{r.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {r.count} ({fmtPct(r.pct)}) · {fmt(r.valor)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                    <div style={{ width: `${r.pct * 100}%`, height: '100%', background: 'var(--danger)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Por canal */}
        <GlassCard title="Hit rate por canal" subtitle="Onde converter mais">
          {data.porCanal.length === 0 ? (
            <p className="text-center py-6" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Sem dados.
            </p>
          ) : (
            <div className="space-y-2">
              {data.porCanal.map((c) => (
                <div key={c.canal} className="flex items-center justify-between">
                  <span style={{ fontSize: 13 }}>{CANAL_LABEL[c.canal] ?? c.canal}</span>
                  <span className="tabular-nums" style={{ fontSize: 12 }}>
                    <strong style={{ color: corHit(c.hitRate) }}>{fmtPct(c.hitRate)}</strong>
                    <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
                      {c.ganhas}/{c.ganhas + c.perdidas} · {fmt(c.receita)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Por commodity */}
        <GlassCard title="Hit rate por commodity" subtitle="Em qual grão somos mais fortes">
          {data.porCommodity.length === 0 ? (
            <p className="text-center py-6" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Sem dados.
            </p>
          ) : (
            <div className="space-y-2">
              {data.porCommodity.map((c) => (
                <div key={c.commodity} className="flex items-center justify-between">
                  <span className="capitalize" style={{ fontSize: 13 }}>{c.commodity}</span>
                  <span className="tabular-nums" style={{ fontSize: 12 }}>
                    <strong style={{ color: corHit(c.hitRate) }}>{fmtPct(c.hitRate)}</strong>
                    <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
                      {c.ganhas}/{c.ganhas + c.perdidas} · {fmt(c.receita)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Por vendedor */}
        <GlassCard title="Top vendedores" subtitle="Hit rate e receita gerada">
          {data.porVendedor.length === 0 ? (
            <p className="text-center py-6" style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              Sem dados de vendedor (propostas sem vendedorId).
            </p>
          ) : (
            <div className="space-y-2">
              {data.porVendedor.map((v, i) => (
                <div key={v.vendedorId} className="flex items-center gap-2">
                  <span className="tabular-nums w-6 text-right" style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                    {i + 1}.
                  </span>
                  <span className="flex-1 truncate" style={{ fontSize: 13 }}>{v.nome}</span>
                  <span className="tabular-nums shrink-0" style={{ fontSize: 12 }}>
                    <strong style={{ color: corHit(v.hitRate) }}>{fmtPct(v.hitRate)}</strong>
                    <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{fmt(v.receita)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}

interface CardProps {
  icon: React.ReactNode
  label: string
  valor: string
  sub: string
  tom: string
}

function Card({ icon, label, valor, sub, tom }: CardProps) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-mute)' }}>
        {icon}
        <span className="eyebrow" style={{ fontSize: 10 }}>{label}</span>
      </div>
      <p className="tabular-nums" style={{ fontSize: 22, fontWeight: 600, color: tom, margin: 0, lineHeight: 1 }}>
        {valor}
      </p>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0 0 0' }}>{sub}</p>
    </div>
  )
}
