'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, Skeleton, EmptyState } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { Trophy, Target, Check } from 'lucide-react'

interface Linha { memberId: string; userId: string | null; nome: string; valorVendido: number; qtdContratos: number; comissao: number; meta: number; atingimento: number | null; posicao?: number }
interface Resp { periodo: string; linhas: Linha[]; totais: { vendido: number; comissao: number; vendedores: number } }

function brl(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) }
function periodoAtual() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` }

export function RankingView({ canEdit }: { canEdit: boolean }) {
  const [periodo, setPeriodo] = useState(periodoAtual())
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMeta, setEditMeta] = useState<Linha | null>(null)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/gestao/ranking?periodo=${periodo}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [periodo])
  useEffect(() => { load() }, [load])

  async function salvarMeta(userId: string, valor: number) {
    try {
      const res = await fetch('/api/gestao/ranking', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, periodo, valorMeta: valor }) })
      if (!res.ok) throw new Error()
      toast.success('Meta salva'); setEditMeta(null); load()
    } catch { toast.error('Falha ao salvar meta') }
  }

  if (loading) return <div className="space-y-3"><Skeleton className="h-28 w-full" /><Skeleton className="h-64 w-full" /></div>
  if (!data) return <EmptyState icon={Trophy} title="Sem dados" description="Não foi possível carregar o ranking." />

  const podio = data.linhas.slice(0, 3)
  const medalha = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text)]" />
        <span className="text-[13px] text-[var(--text-mute)]">{data.totais.vendedores} vendedor(es) · {brl(data.totais.vendido)} vendido · {brl(data.totais.comissao)} comissão</span>
      </div>

      {/* Pódio */}
      {podio.length > 0 && podio.some((p) => p.valorVendido > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {podio.map((p, i) => (
            <Card key={p.memberId} className={`p-4 ${i === 0 ? 'ring-1 ring-[color-mix(in_srgb,var(--accent)_40%,transparent)]' : ''}`}>
              <div className="flex items-center justify-between"><span className="text-[22px]">{medalha[i]}</span><span className="font-mono text-[10px] uppercase text-[var(--text-dim)]">#{i + 1}</span></div>
              <div className="mt-2 text-[14px] font-semibold text-[var(--text)]">{p.nome}</div>
              <div className="mt-1 font-mono text-[18px] font-bold text-[var(--accent)]">{brl(p.valorVendido)}</div>
              <div className="font-mono text-[11px] text-[var(--text-mute)]">{p.qtdContratos} negócio(s) · {brl(p.comissao)} comissão</div>
              {p.atingimento != null && <Barra pct={p.atingimento} />}
            </Card>
          ))}
        </div>
      )}

      {/* Tabela completa */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--border)] px-[18px] py-[14px] text-[14px] font-semibold text-[var(--text)]">Ranking completo</div>
        {data.linhas.length === 0 ? (
          <EmptyState icon={Trophy} title="Nenhum vendedor" description="Marque colaboradores como vendedores em Comissionamento." />
        ) : (
          <div>
            {data.linhas.map((l, i) => (
              <div key={l.memberId} className="flex items-center gap-3 border-t border-[var(--border)] px-[18px] py-3 first:border-t-0">
                <div className="w-6 text-center font-mono text-[13px] font-bold text-[var(--text-dim)]">{i + 1}</div>
                <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[12px] font-bold text-[var(--text-mute)]">{l.nome.slice(0, 2).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[var(--text)]">{l.nome}</div>
                  <div className="font-mono text-[11px] text-[var(--text-mute)]">{l.qtdContratos} negócio(s) · {brl(l.comissao)} comissão</div>
                </div>
                <div className="w-44 flex-shrink-0">
                  {l.meta > 0 ? (
                    <><div className="flex justify-between font-mono text-[10px] text-[var(--text-dim)]"><span>meta {brl(l.meta)}</span><span>{l.atingimento}%</span></div><Barra pct={l.atingimento ?? 0} compact /></>
                  ) : canEdit ? (
                    <button onClick={() => setEditMeta(l)} className="flex items-center gap-1 text-[11px] text-[var(--accent-2)]"><Target size={12} /> Definir meta</button>
                  ) : <span className="text-[11px] text-[var(--text-dim)]">sem meta</span>}
                </div>
                <div className="w-28 flex-shrink-0 text-right font-mono text-[14px] font-bold text-[var(--text)]">{brl(l.valorVendido)}</div>
                {canEdit && l.meta > 0 && <button onClick={() => setEditMeta(l)} className="text-[var(--text-dim)] hover:text-[var(--text)]"><Target size={14} /></button>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {editMeta && editMeta.userId && <MetaModal linha={editMeta} onClose={() => setEditMeta(null)} onSave={(v) => salvarMeta(editMeta.userId!, v)} />}
    </div>
  )
}

function Barra({ pct, compact }: { pct: number; compact?: boolean }) {
  const cor = pct >= 100 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--accent-2)'
  return (
    <div className={`${compact ? 'mt-1' : 'mt-3'} h-[5px] overflow-hidden rounded-full bg-[var(--border)]`}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: cor }} />
    </div>
  )
}

function MetaModal({ linha, onClose, onSave }: { linha: Linha; onClose: () => void; onSave: (v: number) => void }) {
  const [valor, setValor] = useState(linha.meta || 0)
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[var(--r-lg)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-[16px] font-semibold text-[var(--text)]">Meta de {linha.nome}</h2>
        <p className="mb-4 text-[12px] text-[var(--text-mute)]">Valor a vender no período (R$).</p>
        <input type="number" autoFocus value={valor} onChange={(e) => setValor(+e.target.value)} className="w-full rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[15px] text-[var(--text)]" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-[var(--r-sm)] px-4 py-2 text-sm text-[var(--text-mute)]">Cancelar</button>
          <button onClick={() => onSave(valor)} className="inline-flex items-center gap-1.5 rounded-[var(--r-sm)] bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-ink)]"><Check size={15} /> Salvar</button>
        </div>
      </div>
    </div>
  )
}
