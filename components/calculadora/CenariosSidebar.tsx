'use client'
/**
 * S10 M2 — Sidebar lateral em /calculadora com:
 *  - Botão "Salvar cenário" → modal pede nome → POST /api/calculadora/cenarios
 *  - Lista "Meus cenários" → carrega + permite load (onLoad com inputJson)
 *  - Delete por item
 */
import * as React from 'react'
import { Save, FolderOpen, Trash2, X } from 'lucide-react'

interface Cenario {
  id: string
  nome: string
  inputJson: any
  resultadoJson: any
  createdAt: string
}

interface Props {
  /** Snapshot atual do input — usado ao salvar */
  currentInput: any
  /** Snapshot atual do resultado — usado ao salvar */
  currentResult: any
  /** Callback ao carregar — recebe inputJson */
  onLoad: (input: any) => void
}

export function CenariosSidebar({ currentInput, currentResult, onLoad }: Props) {
  const [cenarios, setCenarios] = React.useState<Cenario[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [nome, setNome] = React.useState('')

  const load = React.useCallback(async () => {
    try {
      const r = await fetch('/api/calculadora/cenarios', { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setCenarios(j.cenarios || [])
    } catch (e: any) {
      setError(e?.message || 'falha ao carregar cenários')
    }
  }, [])

  React.useEffect(() => { void load() }, [load])

  async function handleSalvar() {
    if (!nome.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/calculadora/cenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          inputJson: currentInput,
          resultadoJson: currentResult,
        }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setNome('')
      setModalOpen(false)
      await load()
    } catch (e: any) {
      setError(e?.message || 'falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cenário?')) return
    try {
      const r = await fetch(`/api/calculadora/cenarios/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setCenarios((cs) => (cs ? cs.filter((c) => c.id !== id) : cs))
    } catch (e: any) {
      setError(e?.message || 'falha ao excluir')
    }
  }

  return (
    <aside className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Meus cenários</h3>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500"
        >
          <Save className="h-3.5 w-3.5" /> Salvar
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {!cenarios && <p className="text-xs text-zinc-400">Carregando…</p>}
      {cenarios && cenarios.length === 0 && (
        <p className="text-xs text-zinc-400">
          Nenhum cenário salvo. Use "Salvar" pra guardar este cálculo.
        </p>
      )}
      <ul className="space-y-2">
        {cenarios?.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded border border-white/5 px-3 py-2 text-xs">
            <button
              type="button"
              onClick={() => onLoad(c.inputJson)}
              className="flex flex-1 items-center gap-2 text-left text-zinc-200 hover:text-white"
              title="Carregar este cenário"
            >
              <FolderOpen className="h-3.5 w-3.5 text-zinc-400" />
              <span className="truncate">{c.nome}</span>
            </button>
            <button
              type="button"
              onClick={() => handleDelete(c.id)}
              className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-red-400"
              aria-label="Excluir cenário"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-5 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Salvar cenário</h4>
              <button onClick={() => setModalOpen(false)} className="rounded p-1 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block text-xs text-zinc-300">Nome do cenário</label>
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Soja Sorriso 132/sc"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!nome.trim() || saving}
                onClick={handleSalvar}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
