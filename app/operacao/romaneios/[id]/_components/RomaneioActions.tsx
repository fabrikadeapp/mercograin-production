'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Plus } from 'lucide-react'
import { Button, Dialog, Select } from '@/components/ui/phb'

export function RomaneioActions({
  romaneioId,
  status,
  armazens,
}: {
  romaneioId: string
  status: string
  armazens: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [armazemId, setArmazemId] = React.useState(armazens[0]?.id || '')
  const [loading, setLoading] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  async function finalizar() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/romaneios/${romaneioId}/finalizar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ armazemId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro')
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  const canFinalizar = status !== 'recebido' && status !== 'cancelado'

  return (
    <div className="flex gap-2">
      <Link href={`/operacao/balanca?romaneioId=${romaneioId}`}>
        <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />}>
          Adicionar ticket
        </Button>
      </Link>
      {canFinalizar ? (
        <Button leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setOpen(true)}>
          Finalizar
        </Button>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Finalizar romaneio"
        description="Cria/atualiza lote e marca tickets como finalizados."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={finalizar} loading={loading} disabled={!armazemId}>
              Confirmar recepção
            </Button>
          </>
        }
      >
        {err ? <p className="text-small text-neg mb-2">{err}</p> : null}
        <Select
          label="Armazém destino"
          value={armazemId}
          onChange={(e) => setArmazemId(e.target.value)}
          options={armazens.map((a) => ({ value: a.id, label: a.nome }))}
        />
      </Dialog>
    </div>
  )
}
