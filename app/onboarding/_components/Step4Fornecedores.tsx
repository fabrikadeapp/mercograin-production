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

interface FornecedorRow {
  razaoSocial: string
  tipo: string
  cnpj: string
  cidade: string
  uf: string
}

const TIPOS = [
  { value: 'transportadora', label: 'Transportadora' },
  { value: 'armazem', label: 'Armazém' },
  { value: 'insumos', label: 'Insumos' },
  { value: 'certificadora', label: 'Certificadora' },
  { value: 'outros', label: 'Outros' },
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

export function Step4Fornecedores({ onNext, onSkip, onBack }: Props) {
  const [rows, setRows] = useState<FornecedorRow[]>([
    { razaoSocial: '', tipo: 'transportadora', cnpj: '', cidade: '', uf: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(i: number, patch: Partial<FornecedorRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function add() {
    setRows((rs) => [
      ...rs,
      { razaoSocial: '', tipo: 'transportadora', cnpj: '', cidade: '', uf: '' },
    ])
  }

  function remove(i: number) {
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((_, idx) => idx !== i)))
  }

  async function handleContinue() {
    setError(null)
    const valid = rows.filter((r) => r.razaoSocial.trim().length >= 2)
    if (valid.length === 0) {
      onNext()
      return
    }
    setSaving(true)
    try {
      await Promise.all(
        valid.map((r) =>
          fetch('/api/fornecedores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: r.tipo,
              razaoSocial: r.razaoSocial.trim(),
              cnpj: r.cnpj || null,
              cidade: r.cidade || null,
              uf: r.uf || null,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const j = await res.json().catch(() => ({}))
              throw new Error(j?.error || 'Erro ao salvar fornecedor')
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
        <div className="eyebrow text-fg-3 mb-2">PASSO 4 · FORNECEDORES</div>
        <h1 className="text-h2 text-fg-1 mb-2">Seus parceiros logísticos</h1>
        <p className="text-fg-3">
          Cadastre transportadoras, armazéns e fornecedores que você usa
          regularmente.
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
            className="grid grid-cols-1 sm:grid-cols-[1fr_180px_180px_140px_70px_auto] gap-3 items-end border border-border-1 rounded-card bg-bg-1 p-4"
          >
            <Input
              label="Razão social"
              value={r.razaoSocial}
              onChange={(e) => update(i, { razaoSocial: e.target.value })}
              placeholder="Ex: Transportes Águia Ltda"
            />
            <Select
              label="Tipo"
              value={r.tipo}
              onChange={(e) => update(i, { tipo: e.target.value })}
              options={TIPOS}
            />
            <Input
              label="CNPJ"
              value={r.cnpj}
              onChange={(e) => update(i, { cnpj: maskCnpj(e.target.value) })}
              placeholder="00.000.000/0000-00"
            />
            <Input
              label="Cidade"
              value={r.cidade}
              onChange={(e) => update(i, { cidade: e.target.value })}
            />
            <Input
              label="UF"
              value={r.uf}
              onChange={(e) =>
                update(i, { uf: e.target.value.toUpperCase().slice(0, 2) })
              }
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
        Adicionar fornecedor
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
