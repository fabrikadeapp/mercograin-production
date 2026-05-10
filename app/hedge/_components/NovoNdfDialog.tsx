'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/phb'

const inputCls =
  'w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small focus:outline-none focus:border-accent'

export function NovoNdfDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [form, setForm] = React.useState({
    numero: `NDF-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`,
    tipo: 'moeda',
    contraparteNome: '',
    contraparteCnpj: '',
    direcao: 'venda',
    ativoTipo: 'USDBRL',
    notional: '',
    strike: '',
    dataVencimento: '',
    observacoes: '',
  })

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/hedge/ndf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          notional: Number(form.notional),
          strike: Number(form.strike),
          contraparteCnpj: form.contraparteCnpj || undefined,
          observacoes: form.observacoes || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? 'Erro')
      }
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        Novo NDF
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-bg-1 border border-border-1 rounded-lg p-5 w-full max-w-xl space-y-3"
      >
        <h3 className="text-h3 font-sans text-fg-1">Novo NDF</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Número">
            <input
              className={inputCls}
              value={form.numero}
              onChange={(e) => update('numero', e.target.value)}
              required
            />
          </Field>
          <Field label="Tipo">
            <select
              className={inputCls}
              value={form.tipo}
              onChange={(e) => update('tipo', e.target.value)}
            >
              <option value="moeda">Moeda</option>
              <option value="commodity">Commodity</option>
            </select>
          </Field>
          <Field label="Contraparte">
            <input
              className={inputCls}
              value={form.contraparteNome}
              onChange={(e) => update('contraparteNome', e.target.value)}
              required
            />
          </Field>
          <Field label="CNPJ contraparte">
            <input
              className={inputCls}
              value={form.contraparteCnpj}
              onChange={(e) => update('contraparteCnpj', e.target.value)}
            />
          </Field>
          <Field label="Direção">
            <select
              className={inputCls}
              value={form.direcao}
              onChange={(e) => update('direcao', e.target.value)}
            >
              <option value="venda">Venda</option>
              <option value="compra">Compra</option>
            </select>
          </Field>
          <Field label="Ativo">
            <input
              className={inputCls}
              value={form.ativoTipo}
              onChange={(e) => update('ativoTipo', e.target.value)}
              required
            />
          </Field>
          <Field label="Notional">
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={form.notional}
              onChange={(e) => update('notional', e.target.value)}
              required
            />
          </Field>
          <Field label="Strike">
            <input
              type="number"
              step="0.0001"
              className={inputCls}
              value={form.strike}
              onChange={(e) => update('strike', e.target.value)}
              required
            />
          </Field>
          <Field label="Vencimento">
            <input
              type="date"
              className={inputCls}
              value={form.dataVencimento}
              onChange={(e) => update('dataVencimento', e.target.value)}
              required
            />
          </Field>
        </div>
        {err ? <p className="text-neg text-small">{err}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Criar
          </Button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-small">
      <span className="text-fg-3">{label}</span>
      {children}
    </label>
  )
}
