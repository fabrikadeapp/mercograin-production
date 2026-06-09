'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, Skeleton } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { Ship, Check, Clock, AlertTriangle, Upload } from 'lucide-react'

interface Item { id: string; tipo: string; titulo: string; status: string; arquivoUrl: string | null; vencimento: string | null; observacao: string | null }

const STATUS_FLOW = ['pendente', 'em_andamento', 'enviado', 'aprovado'] as const
const STATUS_LABEL: Record<string, string> = { pendente: 'Pendente', em_andamento: 'Em andamento', enviado: 'Enviado', aprovado: 'Aprovado', rejeitado: 'Rejeitado' }
const STATUS_COLOR: Record<string, string> = { pendente: 'var(--text-dim)', em_andamento: 'var(--info)', enviado: 'var(--warning)', aprovado: 'var(--success)', rejeitado: 'var(--danger)' }

export function ChecklistView({ contratoId }: { contratoId: string }) {
  const [itens, setItens] = useState<Item[]>([])
  const [progresso, setProgresso] = useState({ concluidos: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/exportacao/checklist/${contratoId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setItens(d.itens ?? []); setProgresso(d.progresso ?? { concluidos: 0, total: 0 }) })
      .catch(() => toast.error('Falha ao carregar checklist'))
      .finally(() => setLoading(false))
  }, [contratoId, toast])
  useEffect(() => { load() }, [load])

  async function setStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/exportacao/checklist/${contratoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
      if (!res.ok) throw new Error()
      load()
    } catch { toast.error('Falha ao atualizar') }
  }

  if (loading) return <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-48 w-full" /></div>

  const pct = progresso.total > 0 ? Math.round((progresso.concluidos / progresso.total) * 100) : 0

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text)]"><Ship size={16} /> Progresso do embarque</div>
          <span className="font-mono text-[13px] font-bold text-[var(--accent)]">{progresso.concluidos}/{progresso.total} · {pct}%</span>
        </div>
        <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} /></div>
      </Card>

      <Card className="overflow-hidden p-0">
        {itens.map((it) => {
          const vencido = it.vencimento && new Date(it.vencimento) < new Date() && it.status !== 'aprovado'
          return (
            <div key={it.id} className="flex items-center gap-3 border-t border-[var(--border)] px-[18px] py-3 first:border-t-0">
              <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[8px]" style={{ background: `color-mix(in srgb, ${STATUS_COLOR[it.status]} 14%, transparent)`, color: STATUS_COLOR[it.status] }}>
                {it.status === 'aprovado' ? <Check size={15} /> : vencido ? <AlertTriangle size={15} /> : <Clock size={15} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[var(--text)]">{it.titulo}</div>
                <div className="font-mono text-[11px] text-[var(--text-mute)]">
                  {it.tipo}{it.vencimento ? ` · vence ${new Date(it.vencimento).toLocaleDateString('pt-BR')}` : ''}{vencido ? ' · VENCIDO' : ''}
                </div>
              </div>
              <select value={it.status} onChange={(e) => setStatus(it.id, e.target.value)} className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[12px] font-medium" style={{ color: STATUS_COLOR[it.status] }}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
