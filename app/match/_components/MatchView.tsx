'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, Skeleton, EmptyState } from '@/components/ui/phb'
import { GitMerge, ArrowRight } from 'lucide-react'

interface MatchItem {
  ofertaId: string; demandaId: string; score: number; razoes: string[]
  venda?: { numero: string; cultura: string; qtdSc: number; precoSc: number }
  compra?: { numero: string; cultura: string; qtdSc: number; precoSc: number }
}

function brl(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function scoreColor(s: number) { return s >= 80 ? 'var(--success)' : s >= 60 ? 'var(--warning)' : 'var(--text-mute)' }

export function MatchView() {
  const [matches, setMatches] = useState<MatchItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetch('/api/match/sugerir')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setMatches(d.matches ?? []); setTotal(d.totalOfertas ?? 0) })
      .catch(() => setMatches([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
  if (!matches || matches.length === 0) {
    return <EmptyState icon={GitMerge} title="Nenhum match encontrado" description={`${total} oferta(s) aberta(s). Cadastre ofertas de venda e demandas de compra compatíveis para ver sugestões.`} />
  }

  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <Card key={`${m.ofertaId}-${m.demandaId}`} className="p-4">
          <div className="flex items-center gap-4">
            {/* venda */}
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-dim)]">Oferta · venda</div>
              <div className="mt-1 text-[14px] font-semibold text-[var(--text)]">{m.venda?.numero}</div>
              <div className="font-mono text-[11.5px] text-[var(--text-mute)]">{m.venda?.cultura} · {m.venda?.qtdSc.toLocaleString('pt-BR')} sc · {brl(m.venda?.precoSc ?? 0)}/sc</div>
            </div>

            {/* score */}
            <div className="flex flex-col items-center px-2">
              <div className="grid h-12 w-12 place-items-center rounded-full border-2" style={{ borderColor: scoreColor(m.score), color: scoreColor(m.score) }}>
                <span className="font-mono text-[15px] font-bold">{m.score}</span>
              </div>
              <ArrowRight size={16} className="mt-1 text-[var(--text-dim)]" />
            </div>

            {/* compra */}
            <div className="min-w-0 flex-1 text-right">
              <div className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-dim)]">Demanda · compra</div>
              <div className="mt-1 text-[14px] font-semibold text-[var(--text)]">{m.compra?.numero}</div>
              <div className="font-mono text-[11.5px] text-[var(--text-mute)]">{m.compra?.cultura} · {m.compra?.qtdSc.toLocaleString('pt-BR')} sc · {brl(m.compra?.precoSc ?? 0)}/sc</div>
            </div>
          </div>

          {m.razoes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-3">
              {m.razoes.map((r, i) => (
                <span key={i} className="rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--success)]">{r}</span>
              ))}
              <Link href="/propostas/nova" className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-ink)]">
                Criar negócio <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
