'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Input } from '@/components/ui/phb'

interface Props {
  contratos: Array<{ id: string; label: string }>
  operadorDefault: { nome: string; cnpj: string; endereco: string }
}

const CULTURAS = [
  { value: 'soja', label: 'Soja', ncm: '12019000' },
  { value: 'cafe', label: 'Café', ncm: '09011190' },
  { value: 'cacau', label: 'Cacau', ncm: '18010000' },
  { value: 'milho', label: 'Milho', ncm: '10059010' },
  { value: 'oleo_palma', label: 'Óleo de palma', ncm: '15111000' },
  { value: 'borracha', label: 'Borracha', ncm: '40012100' },
]

const STEPS = [
  '1. Operador',
  '2. Produto',
  '3. Cadeia',
  '4. Risco (auto)',
  '5. Revisão',
] as const

export function DDSWizard({ contratos, operadorDefault }: Props) {
  const router = useRouter()
  const [step, setStep] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const [form, setForm] = React.useState({
    operadorNome: operadorDefault.nome,
    operadorCnpj: operadorDefault.cnpj,
    operadorEndereco: operadorDefault.endereco,
    cultura: 'soja',
    ncm: '12019000',
    qtdToneladas: 0,
    contratoId: '',
    observacoes: '',
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit() {
    setSubmitting(true)
    setErr(null)
    try {
      const r = await fetch('/api/eudr/dds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operadorNome: form.operadorNome,
          operadorCnpj: form.operadorCnpj,
          operadorEndereco: form.operadorEndereco,
          cultura: form.cultura,
          ncm: form.ncm,
          qtdToneladas: Number(form.qtdToneladas),
          contratoId: form.contratoId || undefined,
          observacoes: form.observacoes || undefined,
        }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`)
      router.push(`/eudr/dds/${json.id}`)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <div className="flex gap-2 text-xs mb-4 flex-wrap">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`px-2 py-1 rounded ${i === step ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-zinc-400'}`}
          >
            {s}
          </span>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Operador Exportador</h3>
          <Input
            label="Razão Social"
            value={form.operadorNome}
            onChange={(e) => update('operadorNome', e.target.value)}
          />
          <Input
            label="CNPJ"
            value={form.operadorCnpj}
            onChange={(e) => update('operadorCnpj', e.target.value)}
          />
          <Input
            label="Endereço"
            value={form.operadorEndereco}
            onChange={(e) => update('operadorEndereco', e.target.value)}
          />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Produto</h3>
          <label className="block text-xs text-zinc-400">Cultura</label>
          <select
            className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-sm"
            value={form.cultura}
            onChange={(e) => {
              const c = CULTURAS.find((x) => x.value === e.target.value)
              update('cultura', e.target.value)
              if (c) update('ncm', c.ncm)
            }}
          >
            {CULTURAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <Input label="NCM" value={form.ncm} onChange={(e) => update('ncm', e.target.value)} />
          <Input
            label="Quantidade (toneladas)"
            type="number"
            value={String(form.qtdToneladas)}
            onChange={(e) => update('qtdToneladas', Number(e.target.value) as any)}
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Cadeia de custódia — contrato vinculado</h3>
          <p className="text-xs text-zinc-400">
            Ao selecionar contrato, lotes e propriedades de origem serão
            extraídos automaticamente via cadeia talhão→lote.
          </p>
          <label className="block text-xs text-zinc-400">Contrato</label>
          <select
            className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-sm"
            value={form.contratoId}
            onChange={(e) => update('contratoId', e.target.value)}
          >
            <option value="">(sem contrato — DDS manual)</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Avaliação de Risco</h3>
          <p className="text-sm text-zinc-400">
            A avaliação será computada automaticamente ao salvar com base em:
            CAR ativo, georreferenciamento, sobreposições TI/UC/IBAMA e alertas
            MapBiomas (cutoff 31/12/2020) de cada propriedade vinculada.
          </p>
          <Input
            label="Observações (opcional)"
            value={form.observacoes}
            onChange={(e) => update('observacoes', e.target.value)}
          />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-2 text-sm">
          <h3 className="font-semibold">Revisão</h3>
          <p>
            <b>Operador:</b> {form.operadorNome} (CNPJ {form.operadorCnpj})
          </p>
          <p>
            <b>Produto:</b> {form.cultura} · NCM {form.ncm} · {form.qtdToneladas} t
          </p>
          <p>
            <b>Contrato:</b>{' '}
            {form.contratoId
              ? contratos.find((c) => c.id === form.contratoId)?.label
              : '— (sem contrato)'}
          </p>
          {form.observacoes ? <p><b>Obs:</b> {form.observacoes}</p> : null}
          <p className="text-xs text-zinc-500 mt-2">
            Após criar, atestação e geração de PDF estarão disponíveis no detalhe.
          </p>
        </div>
      )}

      {err ? <p className="text-xs text-red-400 mt-3">{err}</p> : null}

      <div className="flex justify-between mt-6">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Voltar
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Próximo</Button>
        ) : (
          <Button disabled={submitting} onClick={submit}>
            {submitting ? 'Criando...' : 'Criar DDS'}
          </Button>
        )}
      </div>
    </Card>
  )
}
