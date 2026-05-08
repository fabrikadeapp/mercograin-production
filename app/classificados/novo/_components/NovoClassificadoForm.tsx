'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Input, Select } from '@/components/ui/phb'

const TIPO_OPTIONS = [
  { value: 'venda', label: 'Venda' },
  { value: 'compra', label: 'Compra' },
]

const GRAO_OPTIONS = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
  { value: 'sorgo', label: 'Sorgo' },
]

const MODAL_OPTIONS = [
  { value: 'FOB', label: 'FOB' },
  { value: 'CIF', label: 'CIF' },
]

export function NovoClassificadoForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      const payload = {
        tipo: String(fd.get('tipo')),
        grao: String(fd.get('grao')),
        variedade: (fd.get('variedade') as string) || null,
        safra: (fd.get('safra') as string) || null,
        volumeSc: Number(fd.get('volumeSc')),
        precoSc: Number(fd.get('precoSc')),
        modal: String(fd.get('modal')),
        cidade: String(fd.get('cidade')),
        uf: String(fd.get('uf')).toUpperCase(),
      }
      const r = await fetch('/api/classificados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${r.status}`)
      }
      router.push('/classificados')
      router.refresh()
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-6 max-w-2xl">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select name="tipo" label="Tipo" options={TIPO_OPTIONS} required defaultValue="venda" />
          <Select name="grao" label="Grão" options={GRAO_OPTIONS} required defaultValue="soja" />
          <Input name="variedade" label="Variedade" placeholder="Ex: Tipo 2, CWAD Premium" />
          <Input name="safra" label="Safra" placeholder="Ex: 24/25" />
          <Input name="volumeSc" label="Volume (sacas)" type="number" min={1} required />
          <Input name="precoSc" label="Preço (R$/sc)" type="number" step="0.01" min={0.01} required />
          <Select name="modal" label="Modal" options={MODAL_OPTIONS} required defaultValue="FOB" />
          <Input name="cidade" label="Cidade" required />
          <Input name="uf" label="UF" maxLength={2} required placeholder="SP" />
        </div>

        {error && <p className="text-neg text-small">Erro: {error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Publicando...' : 'Publicar lote'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
        </div>
      </form>
    </Card>
  )
}
