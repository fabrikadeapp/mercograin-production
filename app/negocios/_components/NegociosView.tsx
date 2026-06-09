'use client'

/**
 * Funil de negócios (F1-04). Kanban por estágio; arrastar move o estágio
 * (PATCH /api/negocios/[id]). Cada card mostra as duas contrapartes.
 */
import { useEffect, useState, useCallback } from 'react'
import { Skeleton, EmptyState } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { Handshake } from 'lucide-react'

interface Negocio { id: string; numero: string; estagio: string; cultura: string | null; qtdSc: number | null; precoSc: number | null; vendedor: string | null; comprador: string | null }

const COLS = [
  { key: 'captado', label: 'Captado', color: 'var(--text-dim)' },
  { key: 'match', label: 'Match', color: 'var(--info)' },
  { key: 'negociacao', label: 'Negociação', color: 'var(--warning)' },
  { key: 'fechado', label: 'Fechado', color: 'var(--accent-2)' },
  { key: 'embarque', label: 'Embarque', color: 'var(--accent-3, var(--warning))' },
  { key: 'liquidacao', label: 'Liquidação', color: 'var(--success)' },
  { key: 'comissao_recebida', label: 'Comissão recebida', color: 'var(--accent)' },
] as const

function brl(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) }

export function NegociosView() {
  const [itens, setItens] = useState<Negocio[]>([])
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/negocios').then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => setItens(d.itens ?? [])).catch(() => setItens([])).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  async function mover(n: Negocio, estagio: string) {
    if (n.estagio === estagio) return
    const ant = n.estagio
    setItens((cur) => cur.map((x) => (x.id === n.id ? { ...x, estagio } : x)))
    try {
      const res = await fetch(`/api/negocios/${n.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estagio }) })
      if (!res.ok) throw new Error()
      toast.success(`${n.numero} → ${COLS.find((c) => c.key === estagio)?.label}`)
    } catch {
      setItens((cur) => cur.map((x) => (x.id === n.id ? { ...x, estagio: ant } : x)))
      toast.error('Não foi possível mover')
    }
  }

  if (loading) return <Skeleton className="h-96 w-full" />
  if (itens.length === 0) return <EmptyState icon={Handshake} title="Nenhum negócio" description="Crie negócios a partir de matches na tela de Match de ofertas." />

  const byCol: Record<string, Negocio[]> = {}
  for (const c of COLS) byCol[c.key] = []
  for (const n of itens) (byCol[n.estagio] ?? (byCol[n.estagio] = [])).push(n)

  return (
    <div className="grid grid-cols-2 gap-3 overflow-x-auto md:grid-cols-4 xl:grid-cols-7">
      {COLS.map((col) => (
        <div key={col.key}
          onDragOver={(e) => { e.preventDefault(); setOver(col.key) }}
          onDragLeave={() => setOver((c) => (c === col.key ? null : c))}
          onDrop={() => { setOver(null); const n = itens.find((x) => x.id === dragId); if (n) mover(n, col.key); setDragId(null) }}
          className={`flex min-w-[160px] flex-col rounded-[12px] border p-2.5 ${over === col.key ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]' : 'border-[var(--border)] bg-[var(--bg-elev)]'}`}>
          <div className="mb-2 flex items-center justify-between border-b border-[var(--border)] pb-2">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--text)]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: col.color }} />{col.label}</span>
            <span className="font-mono text-[10px] font-bold text-[var(--text-dim)]">{(byCol[col.key] ?? []).length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {(byCol[col.key] ?? []).map((n) => (
              <div key={n.id} draggable onDragStart={() => setDragId(n.id)} onDragEnd={() => setDragId(null)}
                className={`cursor-grab rounded-[10px] border border-[var(--border)] bg-[var(--surface-1)] p-2.5 ${dragId === n.id ? 'opacity-50' : ''}`}>
                <div className="font-mono text-[9.5px] text-[var(--text-dim)]">{n.numero}</div>
                <div className="mt-1 text-[12px] font-semibold capitalize text-[var(--text)]">{n.cultura ?? '—'}{n.qtdSc ? ` · ${n.qtdSc.toLocaleString('pt-BR')} sc` : ''}</div>
                {n.precoSc ? <div className="font-mono text-[11px] text-[var(--accent)]">{brl(n.precoSc)}/sc</div> : null}
                <div className="mt-1.5 border-t border-[var(--border)] pt-1.5 text-[10px] text-[var(--text-mute)]">
                  <div>V: {n.vendedor ?? '—'}</div>
                  <div>C: {n.comprador ?? '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
