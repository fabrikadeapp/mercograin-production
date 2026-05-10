'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button } from '@/components/ui/phb'

const CULTURA_OPTS = [
  { value: 'soja', label: 'Soja (ZS)' },
  { value: 'milho', label: 'Milho (ZC)' },
  { value: 'trigo', label: 'Trigo (ZW)' },
] as const

const FUTURO_DEFAULT: Record<string, string> = {
  soja: 'ZS',
  milho: 'ZC',
  trigo: 'ZW',
}

export function NovaPosicaoForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [form, setForm] = React.useState({
    numero: `HDG-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`,
    tipo: 'long' as 'long' | 'short',
    cultura: 'soja',
    contratoFuturo: 'ZS',
    vencimento: '',
    qtdContratos: 1,
    precoEntradaUsdBu: '',
    cambioEntradaUsdBrl: '',
    margemDepositadaUSD: '',
    corretagemUSD: '',
    observacoes: '',
  })

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/hedge/posicoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: form.numero,
          tipo: form.tipo,
          cultura: form.cultura || null,
          contratoFuturo: form.contratoFuturo,
          vencimento: form.vencimento,
          qtdContratos: Number(form.qtdContratos),
          precoEntradaUsdBu: form.precoEntradaUsdBu
            ? Number(form.precoEntradaUsdBu)
            : undefined,
          cambioEntradaUsdBrl: form.cambioEntradaUsdBrl
            ? Number(form.cambioEntradaUsdBrl)
            : undefined,
          margemDepositadaUSD: form.margemDepositadaUSD
            ? Number(form.margemDepositadaUSD)
            : undefined,
          corretagemUSD: form.corretagemUSD ? Number(form.corretagemUSD) : 0,
          observacoes: form.observacoes || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error ?? 'Erro ao criar')
      }
      const created = await res.json()
      router.push(`/hedge/posicoes/${created.id}`)
    } catch (err: any) {
      setError(err.message ?? 'Erro')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Número">
            <input
              className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small focus:outline-none focus:border-accent"
              value={form.numero}
              onChange={(e) => update('numero', e.target.value)}
              required
            />
          </Field>
          <Field label="Tipo">
            <select
              className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small focus:outline-none focus:border-accent"
              value={form.tipo}
              onChange={(e) => update('tipo', e.target.value as 'long' | 'short')}
            >
              <option value="long">Long (compra futuro)</option>
              <option value="short">Short (venda futuro)</option>
            </select>
          </Field>
          <Field label="Cultura">
            <select
              className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small focus:outline-none focus:border-accent"
              value={form.cultura}
              onChange={(e) => {
                update('cultura', e.target.value)
                update('contratoFuturo', FUTURO_DEFAULT[e.target.value] ?? 'ZS')
              }}
            >
              {CULTURA_OPTS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contrato (símbolo)">
            <input
              className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small focus:outline-none focus:border-accent"
              value={form.contratoFuturo}
              onChange={(e) => update('contratoFuturo', e.target.value)}
              required
            />
          </Field>
          <Field label="Vencimento">
            <input
              type="date"
              className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small focus:outline-none focus:border-accent"
              value={form.vencimento}
              onChange={(e) => update('vencimento', e.target.value)}
              required
            />
          </Field>
          <Field label="Qtd contratos">
            <input
              type="number"
              min={1}
              step={1}
              className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small focus:outline-none focus:border-accent"
              value={form.qtdContratos}
              onChange={(e) => update('qtdContratos', Number(e.target.value) as any)}
              required
            />
          </Field>
          <Field label="Preço entrada (USD/bu)">
            <input
              type="number"
              step="0.0001"
              className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small focus:outline-none focus:border-accent"
              value={form.precoEntradaUsdBu}
              onChange={(e) => update('precoEntradaUsdBu', e.target.value as any)}
            />
          </Field>
          <Field label="Câmbio entrada (USD/BRL)">
            <input
              type="number"
              step="0.0001"
              className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small focus:outline-none focus:border-accent"
              value={form.cambioEntradaUsdBrl}
              onChange={(e) =>
                update('cambioEntradaUsdBrl', e.target.value as any)
              }
            />
          </Field>
          <Field label="Margem depositada (USD)">
            <input
              type="number"
              step="0.01"
              className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small focus:outline-none focus:border-accent"
              value={form.margemDepositadaUSD}
              onChange={(e) => update('margemDepositadaUSD', e.target.value as any)}
            />
          </Field>
          <Field label="Corretagem (USD)">
            <input
              type="number"
              step="0.01"
              className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small focus:outline-none focus:border-accent"
              value={form.corretagemUSD}
              onChange={(e) => update('corretagemUSD', e.target.value as any)}
            />
          </Field>
        </div>
        <Field label="Observações">
          <textarea
            className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 text-fg-1 text-small focus:outline-none focus:border-accent"
            rows={3}
            value={form.observacoes}
            onChange={(e) => update('observacoes', e.target.value)}
          />
        </Field>
        {error ? <p className="text-neg text-small">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" loading={submitting}>
            Criar posição
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/hedge/posicoes')}
          >
            Cancelar
          </Button>
        </div>
      </Card>
    </form>
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
