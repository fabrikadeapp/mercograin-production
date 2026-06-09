'use client'

/**
 * Gestão de alertas de preço. Cria, edita o valor, ativa/desativa e remove.
 * Quando a cotação cruza o limite, o cron price-alerts dispara e-mail.
 */
import { useEffect, useState, useCallback } from 'react'
import { Card, Skeleton, EmptyState, Chip } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { Bell, Plus, Trash2, Power } from 'lucide-react'

interface Alerta { id: string; symbol: string; graoLabel: string; operador: string; preco: number; status: string }

const GRAOS = [
  { label: 'Soja', symbol: 'soja' },
  { label: 'Milho', symbol: 'milho' },
  { label: 'Trigo', symbol: 'trigo' },
  { label: 'Dólar', symbol: 'usdbrl' },
]
function brl(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export function AlertasPrecoView() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const toast = useToast()

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/alertas')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setAlertas((d.data ?? []).map((a: any) => ({ ...a, preco: Number(a.preco) }))))
      .catch(() => toast.error('Falha ao carregar'))
      .finally(() => setLoading(false))
  }, [toast])
  useEffect(() => { load() }, [load])

  async function toggle(a: Alerta) {
    const novo = a.status === 'ativo' ? 'inativo' : 'ativo'
    try {
      const res = await fetch(`/api/alertas/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: novo }) })
      if (!res.ok) throw new Error()
      load()
    } catch { toast.error('Falha ao atualizar') }
  }
  async function remover(a: Alerta) {
    try {
      const res = await fetch(`/api/alertas/${a.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Alerta removido'); load()
    } catch { toast.error('Falha ao remover') }
  }
  async function editarPreco(a: Alerta, preco: number) {
    try {
      const res = await fetch(`/api/alertas/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preco }) })
      if (!res.ok) throw new Error()
      load()
    } catch { toast.error('Falha ao atualizar preço') }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)]"><Plus size={15} /> Novo alerta</button>
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="space-y-2 p-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : alertas.length === 0 ? (
          <EmptyState icon={Bell} title="Nenhum alerta" description="Crie um alerta para ser avisado quando a soja, o milho, o trigo ou o dólar cruzarem um preço." />
        ) : alertas.map((a) => (
          <div key={a.id} className="flex items-center gap-3 border-t border-[var(--border)] px-[18px] py-3 first:border-t-0">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--warning)]"><Bell size={16} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--text)]">
                <span className="capitalize">{a.graoLabel}</span> {a.operador}{' '}
                <input type="number" step="0.01" defaultValue={a.preco} onBlur={(e) => { const v = +e.target.value; if (v && v !== a.preco) editarPreco(a, v) }}
                  className="w-24 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 font-mono text-[12.5px] text-[var(--text)]" />
              </div>
              <div className="font-mono text-[11px] text-[var(--text-mute)]">avisa quando {a.graoLabel} ficar {a.operador === '>' ? 'acima' : 'abaixo'} de {brl(a.preco)}</div>
            </div>
            <Chip variant={a.status === 'ativo' ? 'pos' : a.status === 'disparado' ? 'warn' : 'neutral'}>{a.status}</Chip>
            <button onClick={() => toggle(a)} title={a.status === 'ativo' ? 'Desativar' : 'Ativar'} className="grid h-8 w-8 place-items-center rounded-[7px] border border-[var(--border-strong)] text-[var(--text-mute)] hover:text-[var(--text)]"><Power size={14} /></button>
            <button onClick={() => remover(a)} title="Remover" className="grid h-8 w-8 place-items-center rounded-[7px] border border-[var(--border-strong)] text-[var(--danger)]"><Trash2 size={14} /></button>
          </div>
        ))}
      </Card>

      {open && <NovoAlertaModal onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load() }} />}
    </div>
  )
}

function NovoAlertaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [grao, setGrao] = useState('soja')
  const [operador, setOperador] = useState<'>' | '<'>('>')
  const [preco, setPreco] = useState(130)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function salvar() {
    setSaving(true)
    try {
      const g = GRAOS.find((x) => x.symbol === grao)!
      const res = await fetch('/api/alertas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: g.symbol, graoLabel: g.label.toLowerCase(), operador, preco: Number(preco) }) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Falha') }
      toast.success('Alerta criado'); onCreated()
    } catch (e: any) { toast.error(e?.message || 'Erro') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[var(--r-lg)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-[16px] font-semibold text-[var(--text)]">Novo alerta de preço</h2>
        <div className="space-y-3">
          <label className="block"><span className="mb-1 block font-mono text-[10px] uppercase text-[var(--text-mute)]">Grão</span>
            <select value={grao} onChange={(e) => setGrao(e.target.value)} className="w-full rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text)]">
              {GRAOS.map((g) => <option key={g.symbol} value={g.symbol}>{g.label}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block font-mono text-[10px] uppercase text-[var(--text-mute)]">Condição</span>
              <select value={operador} onChange={(e) => setOperador(e.target.value as any)} className="w-full rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text)]">
                <option value=">">Acima de</option><option value="<">Abaixo de</option>
              </select>
            </label>
            <label className="block"><span className="mb-1 block font-mono text-[10px] uppercase text-[var(--text-mute)]">Preço (R$)</span>
              <input type="number" step="0.01" value={preco} onChange={(e) => setPreco(+e.target.value)} className="w-full rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text)]" />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-[var(--r-sm)] px-4 py-2 text-sm text-[var(--text-mute)]">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="rounded-[var(--r-sm)] bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-50">{saving ? 'Salvando…' : 'Criar alerta'}</button>
        </div>
      </div>
    </div>
  )
}
