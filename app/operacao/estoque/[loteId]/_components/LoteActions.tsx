'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRightLeft } from 'lucide-react'
import { Button, Dialog, Input, Select } from '@/components/ui/phb'

export function LoteActions({
  loteId,
  saldoAtual,
  armazens,
}: {
  loteId: string
  saldoAtual: number
  armazens: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [openQuebra, setOpenQuebra] = React.useState(false)
  const [openTransf, setOpenTransf] = React.useState(false)
  const [qtd, setQtd] = React.useState('')
  const [motivo, setMotivo] = React.useState('')
  const [armazemDestinoId, setArmazemDestinoId] = React.useState(armazens[0]?.id || '')
  const [loading, setLoading] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  function reset() {
    setQtd('')
    setMotivo('')
    setErr(null)
  }

  async function submit(tipo: 'quebra_tecnica' | 'transferencia') {
    setLoading(true)
    setErr(null)
    try {
      const body: any = {
        tipo,
        qtdSc: parseFloat(qtd),
        motivo: motivo || null,
      }
      if (tipo === 'transferencia') body.armazemDestinoId = armazemDestinoId
      const r = await fetch(`/api/lotes/${loteId}/movimentacoes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setOpenQuebra(false)
      setOpenTransf(false)
      reset()
      router.refresh()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        leftIcon={<AlertTriangle className="h-4 w-4" />}
        onClick={() => setOpenQuebra(true)}
      >
        Quebra técnica
      </Button>
      <Button
        leftIcon={<ArrowRightLeft className="h-4 w-4" />}
        onClick={() => setOpenTransf(true)}
        disabled={armazens.length === 0}
      >
        Transferir
      </Button>

      <Dialog
        open={openQuebra}
        onOpenChange={(v) => {
          setOpenQuebra(v)
          if (!v) reset()
        }}
        title="Registrar quebra técnica"
        description={`Saldo atual: ${saldoAtual.toLocaleString('pt-BR')} sc`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenQuebra(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => submit('quebra_tecnica')}
              loading={loading}
              disabled={!qtd}
            >
              Registrar
            </Button>
          </>
        }
      >
        {err ? <p className="text-small text-neg mb-2">{err}</p> : null}
        <div className="space-y-3">
          <Input
            label="Quantidade (sc)"
            type="number"
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
          />
          <Input
            label="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: secagem, perda transporte"
          />
        </div>
      </Dialog>

      <Dialog
        open={openTransf}
        onOpenChange={(v) => {
          setOpenTransf(v)
          if (!v) reset()
        }}
        title="Transferir entre armazéns"
        description="Cria lote-destino com a quantidade transferida."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenTransf(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => submit('transferencia')}
              loading={loading}
              disabled={!qtd || !armazemDestinoId}
            >
              Transferir
            </Button>
          </>
        }
      >
        {err ? <p className="text-small text-neg mb-2">{err}</p> : null}
        <div className="space-y-3">
          <Input
            label="Quantidade (sc)"
            type="number"
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
          />
          <Select
            label="Armazém destino"
            value={armazemDestinoId}
            onChange={(e) => setArmazemDestinoId(e.target.value)}
            options={armazens.map((a) => ({ value: a.id, label: a.nome }))}
          />
          <Input
            label="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
      </Dialog>
    </div>
  )
}
