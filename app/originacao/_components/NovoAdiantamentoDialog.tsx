'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button, Dialog, Input, Select } from '@/components/ui/phb'
import { Plus } from 'lucide-react'

interface ContratoOpt {
  id: string
  numero: string
  clienteId: string
}
interface ProdutorOpt {
  id: string
  nome: string
  cnpj?: string | null
}

export function NovoAdiantamentoDialog({
  contratos,
  produtores,
}: {
  contratos: ContratoOpt[]
  produtores: ProdutorOpt[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<1 | 2>(1)
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const [produtorId, setProdutorId] = React.useState('')
  const [contratoId, setContratoId] = React.useState('')
  // Sugestão de número (sufixo do timestamp). Backend pode sobrescrever.
  const [numero, setNumero] = React.useState(() => {
    const now = Date.now().toString()
    return `ADV-${new Date().getFullYear()}-${now.slice(-5)}`
  })
  const [valor, setValor] = React.useState<number>(0)
  const [tipo, setTipo] = React.useState<'dinheiro' | 'insumo' | 'misto'>(
    'dinheiro'
  )
  const [qtdEsperadaSc, setQtdEsperadaSc] = React.useState<number>(0)
  const [dataPrevistaQuit, setDataPrevistaQuit] = React.useState('')
  const [observacoes, setObservacoes] = React.useState('')

  function reset() {
    setStep(1)
    setErr(null)
    setProdutorId('')
    setContratoId('')
    setValor(0)
    setQtdEsperadaSc(0)
    setDataPrevistaQuit('')
    setObservacoes('')
  }

  async function submit() {
    setSaving(true)
    setErr(null)
    try {
      const body: any = {
        numero,
        contratoId,
        produtorId,
        valor: Number(valor),
        tipo,
        qtdEsperadaSc: Number(qtdEsperadaSc),
        observacoes: observacoes || undefined,
      }
      if (dataPrevistaQuit) {
        body.dataPrevistaQuit = new Date(dataPrevistaQuit).toISOString()
      }
      const r = await fetch('/api/adiantamentos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || 'Erro ao criar adiantamento')
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
        <Plus className="h-4 w-4 mr-1" /> Novo adiantamento
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) reset()
        }}
        title={`Novo adiantamento — passo ${step} de 2`}
        description={
          step === 1
            ? 'Identifique o produtor e o contrato vinculado.'
            : 'Defina valor, tipo e quantidade esperada de grão.'
        }
        footer={
          <>
            {step === 2 ? (
              <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
                Voltar
              </Button>
            ) : null}
            {step === 1 ? (
              <Button
                variant="primary"
                onClick={() => setStep(2)}
                disabled={!produtorId || !contratoId}
              >
                Próximo
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={submit}
                disabled={
                  saving || !valor || !qtdEsperadaSc || !numero
                }
              >
                {saving ? 'Salvando...' : 'Criar adiantamento'}
              </Button>
            )}
          </>
        }
      >
        {err ? (
          <div className="mb-3 p-3 rounded-md border border-neg/40 bg-neg/10 text-neg text-small">
            {err}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <Select
              label="Produtor (vendedor)"
              value={produtorId}
              onChange={(e) => setProdutorId(e.target.value)}
              options={[
                { value: '', label: 'Selecione...' },
                ...produtores.map((p) => ({
                  value: p.id,
                  label: `${p.nome}${p.cnpj ? ` · ${p.cnpj}` : ''}`,
                })),
              ]}
            />
            <Select
              label="Contrato vinculado"
              value={contratoId}
              onChange={(e) => setContratoId(e.target.value)}
              options={[
                { value: '', label: 'Selecione...' },
                ...contratos.map((c) => ({
                  value: c.id,
                  label: c.numero,
                })),
              ]}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              label="Número"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Valor (R$)"
                type="number"
                step="0.01"
                value={valor || ''}
                onChange={(e) => setValor(Number(e.target.value))}
              />
              <Select
                label="Tipo"
                value={tipo}
                onChange={(e) =>
                  setTipo(e.target.value as 'dinheiro' | 'insumo' | 'misto')
                }
                options={[
                  { value: 'dinheiro', label: 'Dinheiro' },
                  { value: 'insumo', label: 'Insumo' },
                  { value: 'misto', label: 'Misto' },
                ]}
              />
            </div>
            <Input
              label="Qtd esperada (sacas)"
              type="number"
              step="0.01"
              value={qtdEsperadaSc || ''}
              onChange={(e) => setQtdEsperadaSc(Number(e.target.value))}
            />
            <Input
              label="Data prevista de quitação"
              type="date"
              value={dataPrevistaQuit}
              onChange={(e) => setDataPrevistaQuit(e.target.value)}
            />
            <Input
              label="Observações"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        )}
      </Dialog>
    </>
  )
}
