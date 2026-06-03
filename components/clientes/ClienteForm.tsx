'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input, Select } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { schemas } from '@/lib/utils/validators'
import { isValidCPF, isValidCNPJ, formatCPF, formatCNPJ } from '@/lib/br/documento'

export const clienteFormSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: schemas.phone.optional().or(z.literal('')),
  tipo: z.enum(['comprador', 'vendedor', 'ambos']),
  cpf: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || isValidCPF(v), { message: 'CPF inválido' }),
  cnpj: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || isValidCNPJ(v), { message: 'CNPJ inválido' }),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
})

export type ClienteFormData = z.infer<typeof clienteFormSchema>

const TIPO_OPCOES = [
  { value: 'comprador', label: 'Comprador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'ambos', label: 'Comprador e Vendedor' },
]

export interface ClienteCriado {
  id: string
  nome: string
  [key: string]: unknown
}

export interface ClienteFormProps {
  initialNome?: string
  initialTipo?: 'comprador' | 'vendedor' | 'ambos'
  /** Chamado depois de POST /api/clientes bem-sucedido. */
  onSuccess: (cliente: ClienteCriado) => void
  onCancel?: () => void
  /** Quando true, esconde botão Cancelar e usa layout mais compacto. */
  embedded?: boolean
  /** Label do botão de submit (default: "Criar cliente"). */
  submitLabel?: string
}

/**
 * Formulário reutilizável de criação de cliente. Usado em:
 *  - app/clientes/novo/page.tsx (standalone)
 *  - components/clientes/ClienteQuickCreateModal.tsx (inline em proposta)
 */
export function ClienteForm({
  initialNome,
  initialTipo,
  onSuccess,
  onCancel,
  embedded,
  submitLabel,
}: ClienteFormProps) {
  const { success, error: showError, info } = useToast()
  const [lookingUp, setLookingUp] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteFormSchema),
    defaultValues: {
      tipo: initialTipo ?? 'comprador',
      nome: initialNome ?? '',
    },
  })

  async function handleCnpjBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.target.value
    const clean = raw.replace(/\D/g, '')
    if (clean.length !== 14) return
    if (!isValidCNPJ(clean)) return

    setValue('cnpj', formatCNPJ(clean), { shouldValidate: true })

    setLookingUp(true)
    try {
      const r = await fetch(`/api/br/cnpj/${clean}`)
      if (!r.ok) {
        if (r.status === 404) info('CNPJ não encontrado na Receita')
        else if (r.status === 429) showError('Muitas consultas. Tente em 1h')
        return
      }
      const j = await r.json()
      const current = getValues()
      const fillIfEmpty = (field: keyof ClienteFormData, value: string | null) => {
        if (value && !current[field]) {
          setValue(field, value, { shouldValidate: false })
        }
      }
      fillIfEmpty('nome', j.razaoSocial)
      fillIfEmpty('email', j.email)
      fillIfEmpty('telefone', j.telefone)
      if (!current.endereco) {
        const partes = [
          j.logradouro,
          j.numero,
          j.complemento,
          j.bairro,
          j.cep ? `CEP ${j.cep}` : null,
        ].filter(Boolean)
        if (partes.length > 0) {
          setValue('endereco', partes.join(', '), { shouldValidate: false })
        }
      }
      fillIfEmpty('cidade', j.municipio)
      fillIfEmpty('estado', j.uf)
      success('Dados da empresa preenchidos automaticamente')
    } catch (err) {
      console.error('cnpj lookup failed', err)
    } finally {
      setLookingUp(false)
    }
  }

  function handleCpfBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.target.value
    const clean = raw.replace(/\D/g, '')
    if (clean.length === 11 && isValidCPF(clean)) {
      setValue('cpf', formatCPF(clean), { shouldValidate: true })
    }
  }

  const onSubmit = async (data: ClienteFormData) => {
    try {
      const payload = {
        ...data,
        cpf: data.cpf || undefined,
        cnpj: data.cnpj || undefined,
        email: data.email || undefined,
        telefone: data.telefone || undefined,
      }

      const response = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const res = await response.json()
        throw new Error(res.error || 'Erro ao criar cliente')
      }

      const cliente = (await response.json()) as ClienteCriado
      success('Cliente criado com sucesso!')
      onSuccess(cliente)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar cliente')
    }
  }

  const cnpjReg = register('cnpj')
  const cpfReg = register('cpf')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={embedded ? 'space-y-5' : 'space-y-8'}>
      <section className="space-y-4">
        {!embedded && <p className="eyebrow">Identificação</p>}
        <Input
          label="Nome completo · Razão social *"
          placeholder="João Silva ou Empresa LTDA"
          {...register('nome')}
          error={errors.nome?.message}
          autoFocus={!initialNome}
        />
        <Select
          label="Tipo de cliente *"
          options={TIPO_OPCOES}
          {...register('tipo')}
          error={errors.tipo?.message}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="CPF"
            placeholder="000.000.000-00"
            {...cpfReg}
            onBlur={(e) => {
              cpfReg.onBlur(e)
              handleCpfBlur(e)
            }}
            error={errors.cpf?.message}
          />
          <Input
            label={lookingUp ? 'CNPJ · consultando…' : 'CNPJ'}
            placeholder="00.000.000/0000-00"
            {...cnpjReg}
            onBlur={(e) => {
              cnpjReg.onBlur(e)
              handleCnpjBlur(e)
            }}
            error={errors.cnpj?.message}
            autoFocus={!!initialNome}
          />
        </div>
      </section>

      <section className="space-y-4">
        {!embedded && <p className="eyebrow">Contato</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="E-mail"
            type="email"
            placeholder="email@example.com"
            {...register('email')}
            error={errors.email?.message}
          />
          <Input
            label="Telefone"
            placeholder="(11) 98765-4321"
            {...register('telefone')}
            error={errors.telefone?.message}
          />
        </div>
      </section>

      {!embedded && (
        <section className="space-y-4">
          <p className="eyebrow">Endereço</p>
          <Input
            label="Endereço"
            placeholder="Rua, número, complemento"
            {...register('endereco')}
            error={errors.endereco?.message}
          />
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input
                label="Cidade"
                placeholder="São Paulo"
                {...register('cidade')}
                error={errors.cidade?.message}
              />
            </div>
            <Input
              label="UF"
              placeholder="SP"
              maxLength={2}
              {...register('estado')}
              error={errors.estado?.message}
            />
          </div>
        </section>
      )}

      {embedded && (
        <section className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Input
              label="Cidade"
              placeholder="São Paulo"
              {...register('cidade')}
              error={errors.cidade?.message}
            />
          </div>
          <Input
            label="UF"
            placeholder="SP"
            maxLength={2}
            {...register('estado')}
            error={errors.estado?.message}
          />
        </section>
      )}

      <div className={`flex justify-end gap-3 ${embedded ? 'pt-2' : 'pt-6 border-t border-border-1'}`}>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={isSubmitting}>
          {isSubmitting ? 'Criando…' : (submitLabel ?? 'Criar cliente')}
        </Button>
      </div>
    </form>
  )
}
