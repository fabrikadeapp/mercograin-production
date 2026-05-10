'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button, Dialog, Input, Select } from '@/components/ui/phb'
import { Plus } from 'lucide-react'
import { calcularBarter } from '@/lib/originacao/barter'

interface ContratoOpt {
  id: string
  numero: string
}
interface FornecedorOpt {
  id: string
  razaoSocial: string
}

export function NovoBarterDialog({
  contratos,
  fornecedores,
}: {
  contratos: ContratoOpt[]
  fornecedores: FornecedorOpt[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<1 | 2 | 3>(1)
  const [saving, setSaving] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const [contratoId, setContratoId] = React.useState('')
  const [fornecedorId, setFornecedorId] = React.useState('')
  const [descricao, setDescricao] = React.useState('')
  const [quantidade, setQuantidade] = React.useState<number>(0)
  const [unidade, setUnidade] = React.useState<'kg' | 'l' | 'sc' | 'un'>('kg')
  const [precoUnit, setPrecoUnit] = React.useState<number>(0)
  const [precoFixadoSc, setPrecoFixadoSc] = React.useState<number>(0)

  const calc = calcularBarter({ quantidade, precoUnit }, precoFixadoSc)

  function reset() {
    setStep(1)
    setErr(null)
    setContratoId('')
    setFornecedorId('')
    setDescricao('')
    setQuantidade(0)
    setUnidade('kg')
    setPrecoUnit(0)
    setPrecoFixadoSc(0)
  }

  async function submit() {
    setSaving(true)
    setErr(null)
    try {
      const r = await fetch('/api/barter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contratoId,
          fornecedorId: fornecedorId || undefined,
          descricao,
          quantidade: Number(quantidade),
          unidade,
          precoUnit: Number(precoUnit),
          precoFixadoSc: Number(precoFixadoSc),
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || 'Erro ao criar barter')
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
        <Plus className="h-4 w-4 mr-1" /> Novo barter
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) reset()
        }}
        title={`Novo barter — passo ${step} de 3`}
        description={
          step === 1
            ? 'Vincule contrato e fornecedor de insumo.'
            : step === 2
              ? 'Informe insumo, quantidade e preço unitário.'
              : 'Defina preço fixado do grão para conversão em sacas.'
        }
        footer={
          <>
            {step > 1 ? (
              <Button
                variant="ghost"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                disabled={saving}
              >
                Voltar
              </Button>
            ) : null}
            {step < 3 ? (
              <Button
                variant="primary"
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                disabled={
                  step === 1
                    ? !contratoId
                    : !descricao || !quantidade || !precoUnit
                }
              >
                Próximo
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={submit}
                disabled={
                  saving || !precoFixadoSc || calc.qtdGraoEquivalenteSc <= 0
                }
              >
                {saving ? 'Salvando...' : 'Criar barter'}
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
              label="Contrato"
              value={contratoId}
              onChange={(e) => setContratoId(e.target.value)}
              options={[
                { value: '', label: 'Selecione...' },
                ...contratos.map((c) => ({ value: c.id, label: c.numero })),
              ]}
            />
            <Select
              label="Fornecedor de insumo (opcional)"
              value={fornecedorId}
              onChange={(e) => setFornecedorId(e.target.value)}
              options={[
                { value: '', label: 'Sem fornecedor' },
                ...fornecedores.map((f) => ({
                  value: f.id,
                  label: f.razaoSocial,
                })),
              ]}
            />
          </div>
        ) : step === 2 ? (
          <div className="space-y-3">
            <Input
              label="Descrição do insumo"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Adubo NPK 04-14-08"
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Quantidade"
                type="number"
                step="0.01"
                value={quantidade || ''}
                onChange={(e) => setQuantidade(Number(e.target.value))}
              />
              <Select
                label="Unidade"
                value={unidade}
                onChange={(e) =>
                  setUnidade(e.target.value as 'kg' | 'l' | 'sc' | 'un')
                }
                options={[
                  { value: 'kg', label: 'kg' },
                  { value: 'l', label: 'L' },
                  { value: 'sc', label: 'sc' },
                  { value: 'un', label: 'un' },
                ]}
              />
              <Input
                label="Preço unit (R$)"
                type="number"
                step="0.01"
                value={precoUnit || ''}
                onChange={(e) => setPrecoUnit(Number(e.target.value))}
              />
            </div>
            <div className="text-small text-fg-3">
              Valor total:{' '}
              <span className="t-num text-fg-1">
                R${' '}
                {calc.valorTotal.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              label="Preço fixado do grão (R$/sc)"
              type="number"
              step="0.01"
              value={precoFixadoSc || ''}
              onChange={(e) => setPrecoFixadoSc(Number(e.target.value))}
            />
            <div className="rounded-md p-3 bg-bg-2 border border-border-1 space-y-1">
              <div className="text-small text-fg-3">Resumo</div>
              <div className="flex justify-between">
                <span className="text-fg-2">Valor total insumo:</span>
                <span className="t-num text-fg-1">
                  R${' '}
                  {calc.valorTotal.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-fg-2">Equivalência em grão:</span>
                <span className="t-num text-emerald-400">
                  {calc.qtdGraoEquivalenteSc.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  sc
                </span>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}
