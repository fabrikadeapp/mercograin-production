'use client'
import { useEffect, useState } from 'react'
import { Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/phb'

interface Props {
  workspaceId: string
  onNext: () => void
  onSkip: () => void
  onBack: () => void
}

interface Member {
  id: string
  email: string
  role: string
  commercialRole: string | null
}

const COMMERCIAL_ROLES = [
  { v: '', l: '— sem perfil específico —' },
  { v: 'gestor', l: 'Gestor comercial' },
  { v: 'trader', l: 'Trader' },
  { v: 'vendedor', l: 'Vendedor' },
  { v: 'financeiro', l: 'Financeiro' },
  { v: 'operador', l: 'Operador' },
  { v: 'leitura', l: 'Leitura/Consulta' },
]

function periodoCorrente(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function Step6BhGrain({ workspaceId, onNext, onSkip, onBack }: Props) {
  const [meta, setMeta] = useState<string>('')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/onboarding/bhgrain')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => {
        if (cancelled) return
        setMembers(j.members ?? [])
        if (j.metaAtual != null) setMeta(String(j.metaAtual))
        setLoading(false)
      })
      .catch(() => setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  async function salvar() {
    setSaving(true)
    setError(null)
    setSavedMsg(null)
    try {
      const fd = new FormData()
      fd.set('meta', meta)
      fd.set('periodo', periodoCorrente())
      for (const m of members) {
        fd.append(`role.${m.id}`, m.commercialRole ?? '')
      }
      const res = await fetch('/api/onboarding/bhgrain', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error ?? 'Erro ao salvar')
      setSavedMsg(`Salvo: ${j.metaSet ? '1 meta + ' : ''}${j.rolesSet} perfis atualizados`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-sm text-blue-400 mb-2">
          <Sparkles className="w-4 h-4" />
          <span>BH Grain — Mesa operacional</span>
        </div>
        <h2 className="text-2xl font-semibold mb-1">Configure a inteligência comercial</h2>
        <p className="text-sm opacity-70">
          Defina a meta mensal e os perfis comerciais dos membros. Tudo pode ser ajustado depois em /admin/bhgrain.
        </p>
      </header>

      <section>
        <h3 className="text-sm font-semibold mb-2">Meta mensal de faturamento</h3>
        <p className="text-xs opacity-60 mb-2">
          Período corrente: <strong>{periodoCorrente()}</strong>. Usada no card Faturamento &amp; Meta + simulador.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-70">R$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            placeholder="2.500.000,00"
            className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2">Perfis comerciais dos membros</h3>
        <p className="text-xs opacity-60 mb-3">
          Controla quem pode aprovar/enviar propostas, gerenciar margem, ver financeiro. Opcional — sem perfil cai no role base do workspace.
        </p>
        {loading ? (
          <div className="text-xs opacity-60">Carregando membros…</div>
        ) : members.length === 0 ? (
          <div className="text-xs opacity-60">Nenhum membro além do owner. Você pode adicionar membros no Step 2 (Equipe).</div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-2 rounded bg-black/10">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{m.email}</div>
                  <div className="text-xs opacity-60">Role workspace: {m.role}</div>
                </div>
                <select
                  value={m.commercialRole ?? ''}
                  onChange={(e) => {
                    const v = e.target.value || null
                    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, commercialRole: v } : x)))
                  }}
                  className="bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm min-w-[180px]"
                >
                  {COMMERCIAL_ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
      {savedMsg && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle2 className="w-4 h-4" /> {savedMsg}
        </div>
      )}

      <footer className="flex items-center justify-between pt-4 border-t border-white/10">
        <Button variant="ghost" onClick={onBack}>← Voltar</Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onSkip}>Pular</Button>
          <Button onClick={async () => { await salvar(); if (!error) onNext() }} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar e continuar →'}
          </Button>
        </div>
      </footer>
    </div>
  )
}
