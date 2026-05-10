'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button, Dialog, Input, Select } from '@/components/ui/phb'

interface Motorista {
  id: string
  nome: string
  placa?: string | null
}
interface Contrato {
  id: string
  numero: string
}

export function NovoRomaneioDialog({
  motoristas,
  contratos,
}: {
  motoristas: Motorista[]
  contratos: Contrato[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const [origem, setOrigem] = React.useState('')
  const [destino, setDestino] = React.useState('')
  const [cultura, setCultura] = React.useState<'soja' | 'milho' | 'trigo'>('soja')
  const [motoristaId, setMotoristaId] = React.useState('')
  const [contratosIds, setContratosIds] = React.useState<string[]>([])

  function reset() {
    setStep(1)
    setOrigem('')
    setDestino('')
    setMotoristaId('')
    setContratosIds([])
    setErr(null)
  }

  async function submit() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/romaneios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          origem,
          destino,
          cultura,
          motoristaId: motoristaId || null,
          contratosIds,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro')
      setOpen(false)
      reset()
      router.refresh()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Novo romaneio
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) reset()
        }}
        title={`Novo romaneio · passo ${step}/3`}
        description="Cargas vinculadas a contratos com motorista e veículo."
        footer={
          <>
            {step > 1 ? (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                Voltar
              </Button>
            ) : null}
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={step === 1 && (!origem || !destino)}>
                Próximo
              </Button>
            ) : (
              <Button onClick={submit} loading={loading}>
                Criar romaneio
              </Button>
            )}
          </>
        }
      >
        {err ? <p className="text-small text-neg mb-3">{err}</p> : null}
        {step === 1 ? (
          <div className="space-y-3">
            <Input
              label="Origem"
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              placeholder="Fazenda / cooperativa"
            />
            <Input
              label="Destino"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Armazém / indústria"
            />
            <Select
              label="Cultura"
              value={cultura}
              onChange={(e) => setCultura(e.target.value as any)}
              options={[
                { value: 'soja', label: 'Soja' },
                { value: 'milho', label: 'Milho' },
                { value: 'trigo', label: 'Trigo' },
              ]}
            />
          </div>
        ) : null}
        {step === 2 ? (
          <div className="space-y-2">
            <p className="eyebrow">Contratos vinculados</p>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {contratos.length === 0 ? (
                <p className="text-small text-fg-3">Nenhum contrato disponível.</p>
              ) : (
                contratos.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-zinc-900/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={contratosIds.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) setContratosIds([...contratosIds, c.id])
                        else setContratosIds(contratosIds.filter((x) => x !== c.id))
                      }}
                    />
                    <span className="font-mono text-sm">{c.numero}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="space-y-3">
            <Select
              label="Motorista"
              value={motoristaId}
              onChange={(e) => setMotoristaId(e.target.value)}
              placeholder="Selecione um motorista (opcional)"
              options={motoristas.map((m) => ({
                value: m.id,
                label: m.placa ? `${m.nome} · ${m.placa}` : m.nome,
              }))}
            />
            <div className="bg-zinc-900/40 rounded p-3 text-sm">
              <p className="eyebrow mb-1">Resumo</p>
              <p>
                <span className="text-fg-3">Origem:</span> {origem || '—'}
              </p>
              <p>
                <span className="text-fg-3">Destino:</span> {destino || '—'}
              </p>
              <p>
                <span className="text-fg-3">Cultura:</span> {cultura}
              </p>
              <p>
                <span className="text-fg-3">Contratos:</span> {contratosIds.length}
              </p>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  )
}
