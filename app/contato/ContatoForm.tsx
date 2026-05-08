'use client'

import * as React from 'react'
import { z } from 'zod'
import { Button, Input } from '@/components/ui/phb'

const schema = z.object({
  nome: z.string().min(2, 'Nome precisa ter ao menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  empresa: z.string().optional(),
  mensagem: z.string().min(10, 'Mensagem precisa ter ao menos 10 caracteres'),
})

type FormState = z.infer<typeof schema>

const INITIAL: FormState = { nome: '', email: '', empresa: '', mensagem: '' }

export function ContatoForm() {
  const [form, setForm] = React.useState<FormState>(INITIAL)
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({})
  const [status, setStatus] = React.useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle',
  )
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    const parsed = schema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormState, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setStatus('submitting')
    try {
      const res = await fetch('/api/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || 'Falha ao enviar')
      }
      setStatus('success')
      setForm(INITIAL)
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Erro inesperado')
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-pos/40 bg-pos/5 p-6">
        <h3 className="text-h3 font-semibold text-fg-1">Mensagem recebida</h3>
        <p className="text-small text-fg-2">
          Obrigado pelo contato. Vamos retornar em até 1 dia útil no email informado.
        </p>
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStatus('idle')}
            type="button"
          >
            Enviar outra mensagem
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        label="Nome"
        value={form.nome}
        onChange={(e) => update('nome', e.target.value)}
        error={errors.nome}
        autoComplete="name"
        required
      />
      <Input
        label="Email"
        type="email"
        value={form.email}
        onChange={(e) => update('email', e.target.value)}
        error={errors.email}
        autoComplete="email"
        required
      />
      <Input
        label="Empresa (opcional)"
        value={form.empresa ?? ''}
        onChange={(e) => update('empresa', e.target.value)}
        error={errors.empresa}
        autoComplete="organization"
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contato-mensagem" className="eyebrow">
          Mensagem
        </label>
        <textarea
          id="contato-mensagem"
          rows={5}
          value={form.mensagem}
          onChange={(e) => update('mensagem', e.target.value)}
          className="w-full rounded-md border border-border-1 bg-bg-1 px-3 py-2.5 text-body text-fg-1 placeholder:text-fg-3 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          required
        />
        {errors.mensagem ? (
          <p className="text-micro text-neg">{errors.mensagem}</p>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-neg/40 bg-neg/5 p-3 text-small text-neg">
          {errorMessage}
        </p>
      ) : null}

      <div>
        <Button type="submit" variant="primary" size="md" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Enviando...' : 'Enviar mensagem'}
        </Button>
      </div>
    </form>
  )
}
