'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, GripVertical, Pencil } from 'lucide-react'
import { AppShell, PageHeader, Card, Button } from '@/components/ui/phb'
import { Chip } from '@/components/ui/phb/primitives/Chip'
import { useToast } from '@/contexts/ToastContext'

interface Clausula {
  id: string
  ordem: number
  tipo: string
  titulo: string
  texto: string
  obrigatoria: boolean
}

const TIPOS = [
  { value: 'multa', label: 'Multa' },
  { value: 'arbitragem', label: 'Arbitragem' },
  { value: 'foro', label: 'Foro' },
  { value: 'forca_maior', label: 'Força maior' },
  { value: 'pagamento', label: 'Pagamento' },
  { value: 'entrega', label: 'Entrega' },
  { value: 'outras', label: 'Outras' },
]

export default function ClausulasContratoPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const [clausulas, setClausulas] = useState<Clausula[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Clausula | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    tipo: 'outras',
    titulo: '',
    texto: '',
    obrigatoria: true,
  })

  async function reload() {
    setLoading(true)
    const r = await fetch(`/api/contratos/${params.id}/clausulas`)
    const data = await r.json()
    setClausulas(data?.clausulas ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (params?.id) reload()
  }, [params?.id])

  async function criar() {
    if (!draft.titulo || !draft.texto) {
      toast.error('Preencha título e texto')
      return
    }
    const ordem = clausulas.length
    const r = await fetch(`/api/contratos/${params.id}/clausulas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, ordem }),
    })
    if (!r.ok) {
      toast.error('Falha ao criar')
      return
    }
    toast.success('Cláusula criada')
    setCreating(false)
    setDraft({ tipo: 'outras', titulo: '', texto: '', obrigatoria: true })
    reload()
  }

  async function salvarEdicao() {
    if (!editing) return
    const r = await fetch(
      `/api/contratos/${params.id}/clausulas/${editing.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: editing.titulo,
          texto: editing.texto,
          tipo: editing.tipo,
          obrigatoria: editing.obrigatoria,
        }),
      }
    )
    if (!r.ok) {
      toast.error('Falha ao salvar')
      return
    }
    toast.success('Cláusula atualizada')
    setEditing(null)
    reload()
  }

  async function remover(id: string) {
    if (!confirm('Remover esta cláusula?')) return
    const r = await fetch(`/api/contratos/${params.id}/clausulas/${id}`, {
      method: 'DELETE',
    })
    if (!r.ok) {
      toast.error('Falha')
      return
    }
    toast.success('Removida')
    reload()
  }

  async function moverOrdem(id: string, delta: number) {
    const idx = clausulas.findIndex((c) => c.id === id)
    if (idx < 0) return
    const novoIdx = idx + delta
    if (novoIdx < 0 || novoIdx >= clausulas.length) return
    const a = clausulas[idx]
    const b = clausulas[novoIdx]
    await Promise.all([
      fetch(`/api/contratos/${params.id}/clausulas/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordem: b.ordem }),
      }),
      fetch(`/api/contratos/${params.id}/clausulas/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordem: a.ordem }),
      }),
    ])
    reload()
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Contratos"
        title="Cláusulas do contrato"
        subtitle={`Contrato ${params.id}`}
        search={false}
        showBell={false}
        actions={
          <div className="flex gap-2">
            <Link href={`/contratos/${params.id}`}>
              <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Voltar
              </Button>
            </Link>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Nova cláusula
            </Button>
          </div>
        }
      />

      {loading && <p className="text-fg-3">Carregando…</p>}

      {!loading && clausulas.length === 0 && (
        <Card>
          <p className="text-fg-2">Nenhuma cláusula cadastrada para este contrato.</p>
        </Card>
      )}

      <div className="space-y-3">
        {clausulas.map((c) => (
          <Card key={c.id}>
            {editing?.id === c.id ? (
              <div className="space-y-3">
                <input
                  className="w-full border border-border-1 rounded px-3 py-2"
                  value={editing.titulo}
                  onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
                />
                <select
                  className="w-full border border-border-1 rounded px-3 py-2"
                  value={editing.tipo}
                  onChange={(e) => setEditing({ ...editing, tipo: e.target.value })}
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <textarea
                  className="w-full border border-border-1 rounded px-3 py-2 min-h-[120px]"
                  value={editing.texto}
                  onChange={(e) => setEditing({ ...editing, texto: e.target.value })}
                />
                <label className="flex items-center gap-2 text-small">
                  <input
                    type="checkbox"
                    checked={editing.obrigatoria}
                    onChange={(e) => setEditing({ ...editing, obrigatoria: e.target.checked })}
                  />
                  Obrigatória
                </label>
                <div className="flex gap-2">
                  <Button size="sm" onClick={salvarEdicao}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="flex flex-col gap-1 pt-1">
                  <button onClick={() => moverOrdem(c.id, -1)} className="text-fg-3 hover:text-fg-1">
                    ↑
                  </button>
                  <GripVertical className="h-4 w-4 text-fg-3" />
                  <button onClick={() => moverOrdem(c.id, 1)} className="text-fg-3 hover:text-fg-1">
                    ↓
                  </button>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-tiny text-fg-3">#{c.ordem}</span>
                    <Chip variant={c.obrigatoria ? 'pos' : 'warn'}>
                      {TIPOS.find((t) => t.value === c.tipo)?.label ?? c.tipo}
                    </Chip>
                  </div>
                  <h3 className="font-semibold mb-1">{c.titulo}</h3>
                  <p className="text-fg-2 text-small whitespace-pre-wrap">{c.texto}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="ghost" leftIcon={<Pencil className="h-3 w-3" />} onClick={() => setEditing(c)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" leftIcon={<Trash2 className="h-3 w-3" />} onClick={() => remover(c.id)} className="text-neg">
                    Remover
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <h3 className="font-semibold mb-3">Nova cláusula</h3>
            <div className="space-y-3">
              <input
                className="w-full border border-border-1 rounded px-3 py-2"
                placeholder="Título"
                value={draft.titulo}
                onChange={(e) => setDraft({ ...draft, titulo: e.target.value })}
              />
              <select
                className="w-full border border-border-1 rounded px-3 py-2"
                value={draft.tipo}
                onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <textarea
                className="w-full border border-border-1 rounded px-3 py-2 min-h-[140px]"
                placeholder="Texto da cláusula"
                value={draft.texto}
                onChange={(e) => setDraft({ ...draft, texto: e.target.value })}
              />
              <label className="flex items-center gap-2 text-small">
                <input
                  type="checkbox"
                  checked={draft.obrigatoria}
                  onChange={(e) => setDraft({ ...draft, obrigatoria: e.target.checked })}
                />
                Obrigatória
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
                <Button onClick={criar}>Criar</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  )
}
