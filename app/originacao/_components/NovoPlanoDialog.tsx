'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button, Dialog, Input, Select } from '@/components/ui/phb'
import { Plus } from 'lucide-react'

interface SafraOpt {
  id: string
  nome: string
  cultura: string
  ativa: boolean
}

export function NovoPlanoDialog({ safras }: { safras: SafraOpt[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const [cultura, setCultura] = React.useState('soja')
  const [safraId, setSafraId] = React.useState('')
  const [qtdPrevistaSc, setQtdPrevistaSc] = React.useState<number>(0)
  const [precoMedioPrevistoSc, setPrecoMedioPrevistoSc] =
    React.useState<number>(0)
  const [observacoes, setObservacoes] = React.useState('')

  function reset() {
    setCultura('soja')
    setSafraId('')
    setQtdPrevistaSc(0)
    setPrecoMedioPrevistoSc(0)
    setObservacoes('')
    setErr(null)
  }

  async function submit() {
    setSaving(true)
    setErr(null)
    try {
      const r = await fetch('/api/planos-vendas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cultura,
          safraId: safraId || undefined,
          qtdPrevistaSc: Number(qtdPrevistaSc),
          precoMedioPrevistoSc: precoMedioPrevistoSc
            ? Number(precoMedioPrevistoSc)
            : undefined,
          observacoes: observacoes || undefined,
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || 'Erro ao criar plano')
      }
      setOpen(false)
      reset()
      router.refresh()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="primary">
        <Plus className="h-4 w-4 mr-1" /> Novo plano
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) reset()
        }}
        title="Novo plano de vendas"
        description="Defina meta de venda por cultura e safra."
        footer={
          <Button
            variant="primary"
            onClick={submit}
            disabled={saving || !cultura || !qtdPrevistaSc}
          >
            {saving ? 'Salvando...' : 'Criar plano'}
          </Button>
        }
      >
        {err ? (
          <div className="mb-3 p-3 rounded-md border border-neg/40 bg-neg/10 text-neg text-small">
            {err}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Cultura"
              value={cultura}
              onChange={(e) => setCultura(e.target.value)}
              options={[
                { value: 'soja', label: 'Soja' },
                { value: 'milho', label: 'Milho' },
                { value: 'trigo', label: 'Trigo' },
                { value: 'sorgo', label: 'Sorgo' },
              ]}
            />
            <Select
              label="Safra (opcional)"
              value={safraId}
              onChange={(e) => setSafraId(e.target.value)}
              options={[
                { value: '', label: 'Sem safra' },
                ...safras.map((s) => ({
                  value: s.id,
                  label: `${s.nome} · ${s.cultura}${s.ativa ? '' : ' (inativa)'}`,
                })),
              ]}
            />
          </div>
          <Input
            label="Qtd prevista (sacas)"
            type="number"
            step="1"
            value={qtdPrevistaSc || ''}
            onChange={(e) => setQtdPrevistaSc(Number(e.target.value))}
          />
          <Input
            label="Preço médio previsto (R$/sc) — opcional"
            type="number"
            step="0.01"
            value={precoMedioPrevistoSc || ''}
            onChange={(e) => setPrecoMedioPrevistoSc(Number(e.target.value))}
          />
          <Input
            label="Observações"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
      </Dialog>
    </>
  )
}
