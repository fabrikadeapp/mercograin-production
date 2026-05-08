'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { schemas } from '@/lib/utils/validators'

const clienteSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: schemas.phone.optional().or(z.literal('')),
  tipo: z.enum(['comprador', 'vendedor', 'ambos']),
  cpf: z.string().optional().or(z.literal('')),
  cnpj: z.string().optional().or(z.literal('')),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
})

type ClienteFormData = z.infer<typeof clienteSchema>

const TIPO_OPCOES = [
  { value: 'comprador', label: 'Comprador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'ambos', label: 'Comprador e Vendedor' },
]

export default function NovoClientePage() {
  const router = useRouter()
  const { success, error: showError } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: { tipo: 'comprador' },
  })

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

      success('Cliente criado com sucesso!')
      router.push('/clientes')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar cliente')
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Cadastro · Novo registro"
        title="Novo cliente"
        subtitle="Preencha os dados básicos do cliente ou contraparte comercial."
        search={false}
        actions={
          <Link href="/clientes">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <section className="space-y-4">
            <p className="eyebrow">Identificação</p>
            <Input
              label="Nome completo · Razão social *"
              placeholder="João Silva ou Empresa LTDA"
              {...register('nome')}
              error={errors.nome?.message}
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
                {...register('cpf')}
                error={errors.cpf?.message}
              />
              <Input
                label="CNPJ"
                placeholder="00.000.000/0000-00"
                {...register('cnpj')}
                error={errors.cnpj?.message}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Contato</p>
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

          <div className="flex justify-end gap-3 pt-6 border-t border-border-1">
            <Link href="/clientes">
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Criando…' : 'Criar cliente'}
            </Button>
          </div>
        </form>
      </Card>
    </AppShell>
  )
}
