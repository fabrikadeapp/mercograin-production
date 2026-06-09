'use client'

/**
 * LeadsView — funil de leads (prospects). Lead = Cliente com statusCadastral
 * 'rascunho' (novo) ou 'analise' (qualificando). Form de cadastro rápido +
 * lista. "Qualificar" não some daqui; "Converter em cliente" aprova o cadastro.
 */
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, Card, DenseTable, Chip, Skeleton, EmptyState } from '@/components/ui/phb'
import type { DenseTableColumn } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { UserPlus, Sparkles } from 'lucide-react'

interface Lead {
  id: string
  nome: string
  email: string | null
  whatsapp: string | null
  telefone: string | null
  tipo: string
  statusCadastral: string
  createdAt: string
}

export function LeadsView({ abrirNovo = false }: { abrirNovo?: boolean }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(abrirNovo)
  const toast = useToast()
  const router = useRouter()

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/leads')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setLeads(d.leads ?? []))
      .catch(() => toast.error('Falha ao carregar leads'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => { load() }, [load])

  const columns: DenseTableColumn<Lead>[] = [
    { key: 'nome', header: 'Lead', accessor: (r) => (
      <div>
        <div className="font-semibold text-[var(--text)]">{r.nome}</div>
        <div className="font-mono text-[10.5px] text-[var(--text-mute)]">{r.email || r.whatsapp || r.telefone || 'sem contato'}</div>
      </div>
    ) },
    { key: 'tipo', header: 'Interesse', accessor: (r) => <span className="capitalize text-[var(--text-mute)]">{r.tipo}</span> },
    { key: 'status', header: 'Etapa', accessor: (r) => <Chip variant={r.statusCadastral === 'analise' ? 'info' : 'neutral'}>{r.statusCadastral === 'analise' ? 'Qualificando' : 'Novo'}</Chip> },
    { key: 'data', header: 'Entrada', align: 'right', accessor: (r) => new Date(r.createdAt).toLocaleDateString('pt-BR') },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mesa · Funil"
        title="Leads"
        subtitle="Prospects no funil. Ao qualificar, o lead vira cliente efetivo."
        actions={
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)]">
            <UserPlus size={15} /> Novo lead
          </button>
        }
      />

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="space-y-2 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : leads.length === 0 ? (
          <EmptyState icon={Sparkles} title="Nenhum lead ainda" description="Cadastre o primeiro prospect para começar o funil." />
        ) : (
          <DenseTable columns={columns} rows={leads} rowKey={(r) => r.id} onRowClick={(r) => router.push(`/clientes/${r.id}`)} />
        )}
      </Card>

      {open && <NovoLeadModal onClose={() => setOpen(false)} onCreated={() => { setOpen(false); load() }} />}
    </div>
  )
}

function NovoLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nome: '', email: '', whatsapp: '', telefone: '', tipo: 'vendedor' })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit() {
    if (form.nome.trim().length < 2) { toast.error('Informe o nome do lead'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Falha ao criar lead')
      }
      toast.success('Lead cadastrado')
      onCreated()
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar lead')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[var(--r-lg)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-[17px] font-semibold text-[var(--text)]">Novo lead</h2>
        <p className="mb-4 text-[12.5px] text-[var(--text-mute)]">Cadastro rápido — você completa os dados ao qualificar.</p>
        <div className="space-y-3">
          <Field label="Nome *"><input autoFocus value={form.nome} onChange={(e) => set('nome', e.target.value)} className="inp" placeholder="Nome do produtor / empresa" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="WhatsApp"><input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} className="inp" placeholder="(00) 0000-0000" /></Field>
            <Field label="Telefone"><input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} className="inp" placeholder="opcional" /></Field>
          </div>
          <Field label="E-mail"><input value={form.email} onChange={(e) => set('email', e.target.value)} className="inp" placeholder="opcional" /></Field>
          <Field label="Interesse">
            <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)} className="inp">
              <option value="vendedor">Vender grãos (produtor)</option>
              <option value="comprador">Comprar grãos</option>
              <option value="ambos">Ambos</option>
            </select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-[var(--r-sm)] px-4 py-2 text-sm text-[var(--text-mute)] hover:text-[var(--text)]">Cancelar</button>
          <button onClick={submit} disabled={saving} className="rounded-[var(--r-sm)] bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-50">{saving ? 'Salvando…' : 'Cadastrar lead'}</button>
        </div>
      </div>
      <style jsx>{`
        .inp { width: 100%; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 9px 12px; font-size: 13px; color: var(--text); }
        .inp:focus { outline: none; border-color: var(--accent-2); }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-[var(--text-mute)]">{label}</span>
      {children}
    </label>
  )
}
