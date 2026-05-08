'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, Input, Select, IconButton } from '@/components/ui/phb'

interface Props {
  workspaceId: string
  onNext: () => void
  onSkip: () => void
  onBack: () => void
}

interface ClienteRow {
  nome: string
  cnpj: string
  tipo: 'comprador' | 'vendedor'
}

const TIPOS = [
  { value: 'comprador', label: 'Comprador' },
  { value: 'vendedor', label: 'Vendedor' },
]

function maskCnpj(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function Step3Clientes({ onNext, onSkip, onBack }: Props) {
  const [rows, setRows] = useState<ClienteRow[]>([
    { nome: '', cnpj: '', tipo: 'comprador' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(i: number, patch: Partial<ClienteRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function add() {
    setRows((rs) => [...rs, { nome: '', cnpj: '', tipo: 'comprador' }])
  }

  function remove(i: number) {
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((_, idx) => idx !== i)))
  }

  async function handleContinue() {
    setError(null)
    const valid = rows.filter((r) => r.nome.trim().length >= 3)
    if (valid.length === 0) {
      // Nada preenchido - apenas avança (equivalente a skip)
      onNext()
      return
    }
    setSaving(true)
    try {
      await Promise.all(
        valid.map((r) =>
          fetch('/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nome: r.nome.trim(),
              cnpj: r.cnpj || undefined,
              tipo: r.tipo,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const j = await res.json().catch(() => ({}))
              throw new Error(j?.error || 'Erro ao salvar cliente')
            }
          })
        )
      )
      onNext()
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow text-fg-3 mb-2">PASSO 3 · CLIENTES</div>
        <h1 className="text-h2 text-fg-1 mb-2">Cadastre seus clientes</h1>
        <p className="text-fg-3">
          Adicione compradores e vendedores principais. Você pode importar uma
          planilha completa depois em Clientes.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-neg/10 border border-neg/30 text-neg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-1 sm:grid-cols-[1fr_200px_180px_auto] gap-3 items-end border border-border-1 rounded-card bg-bg-1 p-4"
          >
            <Input
              label="Nome / Razão social"
              value={r.nome}
              onChange={(e) => update(i, { nome: e.target.value })}
              placeholder="Ex: Cooperativa Sul Ltda"
            />
            <Input
              label="CNPJ"
              value={r.cnpj}
              onChange={(e) => update(i, { cnpj: maskCnpj(e.target.value) })}
              placeholder="00.000.000/0000-00"
            />
            <Select
              label="Tipo"
              value={r.tipo}
              onChange={(e) => update(i, { tipo: e.target.value as 'comprador' | 'vendedor' })}
              options={TIPOS}
            />
            <IconButton
              type="button"
              aria-label="Remover"
              onClick={() => remove(i)}
              disabled={rows.length === 1}
            >
              <X className="w-4 h-4" />
            </IconButton>
          </div>
        ))}
      </div>

      <Button type="button" variant="secondary" onClick={add} leftIcon={<Plus className="w-4 h-4" />}>
        Adicionar cliente
      </Button>

      <div className="flex items-center justify-between pt-4 border-t border-border-1">
        <Button type="button" variant="ghost" onClick={onBack}>
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onSkip}>
            Pular por enquanto
          </Button>
          <Button type="button" onClick={handleContinue} loading={saving} size="lg">
            Continuar
          </Button>
        </div>
      </div>
    </div>
  )
}
