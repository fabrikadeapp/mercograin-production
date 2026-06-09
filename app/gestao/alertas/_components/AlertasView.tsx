'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, Skeleton, EmptyState } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { Bell, AlertTriangle, Info, Check, X } from 'lucide-react'

interface Alerta { id: string; severity: string; category: string; title: string; description: string | null; relatedEntityType: string | null; relatedEntityId: string | null; status: string; createdAt: string }

const SEV_COLOR: Record<string, string> = { critico: 'var(--danger)', atencao: 'var(--warning)', informativo: 'var(--info)' }
const SEV_ICON: Record<string, any> = { critico: AlertTriangle, atencao: AlertTriangle, informativo: Info }
const CAT_LABEL: Record<string, string> = {
  preco_vencido: 'Preço vencido', margem_baixa: 'Margem baixa', follow_up: 'Follow-up', concentracao: 'Concentração',
  meta_risco: 'Risco de meta', integracao_erro: 'Integração', comissao_atraso: 'Comissão atrasada',
}

export function AlertasView() {
  const [data, setData] = useState<{ alertas: Alerta[]; contagem: { total: number; critico: number; atencao: number } } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/alertas-comerciais').then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  async function acao(id: string, acao: 'resolver' | 'ignorar') {
    setBusy(id)
    try {
      const res = await fetch('/api/alertas-comerciais', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, acao }) })
      if (!res.ok) throw new Error()
      load()
    } catch { toast.error('Falha') } finally { setBusy(null) }
  }

  if (loading) return <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-48 w-full" /></div>
  if (!data || data.alertas.length === 0) return <EmptyState icon={Bell} title="Nenhum alerta" description="Tudo sob controle. Os crons geram alertas de preço, follow-up e margem automaticamente." />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">Abertos</div><div className="mt-2 font-mono text-[22px] font-bold text-[var(--text)]">{data.contagem.total}</div></Card>
        <Card className="p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">Críticos</div><div className="mt-2 font-mono text-[22px] font-bold" style={{ color: data.contagem.critico > 0 ? 'var(--danger)' : 'var(--text)' }}>{data.contagem.critico}</div></Card>
        <Card className="p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">Atenção</div><div className="mt-2 font-mono text-[22px] font-bold" style={{ color: data.contagem.atencao > 0 ? 'var(--warning)' : 'var(--text)' }}>{data.contagem.atencao}</div></Card>
      </div>

      <Card className="overflow-hidden p-0">
        {data.alertas.map((a) => {
          const Icon = SEV_ICON[a.severity] ?? Info
          return (
            <div key={a.id} className="flex items-start gap-3 border-t border-[var(--border)] px-[18px] py-3 first:border-t-0">
              <div className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-[8px]" style={{ background: `color-mix(in srgb, ${SEV_COLOR[a.severity]} 14%, transparent)`, color: SEV_COLOR[a.severity] }}><Icon size={15} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[var(--text)]">{a.title}</span>
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--text-mute)]">{CAT_LABEL[a.category] ?? a.category}</span>
                </div>
                {a.description && <div className="mt-1 text-[12px] text-[var(--text-mute)]">{a.description}</div>}
                <div className="mt-1 font-mono text-[10.5px] text-[var(--text-dim)]">{new Date(a.createdAt).toLocaleString('pt-BR')}{a.status !== 'aberto' ? ` · ${a.status}` : ''}</div>
              </div>
              {a.status === 'aberto' && (
                <div className="flex flex-shrink-0 gap-1.5">
                  <button onClick={() => acao(a.id, 'resolver')} disabled={busy === a.id} title="Resolver" className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--border-strong)] text-[var(--success)] disabled:opacity-50"><Check size={14} /></button>
                  <button onClick={() => acao(a.id, 'ignorar')} disabled={busy === a.id} title="Ignorar" className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--border-strong)] text-[var(--text-mute)] disabled:opacity-50"><X size={14} /></button>
                </div>
              )}
            </div>
          )
        })}
      </Card>
    </div>
  )
}
