'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      tipo: 'comprador',
    },
  })

  const tipo = watch('tipo')

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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link href="/clientes" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Voltar para Clientes
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Novo Cliente</h1>
          <p className="text-gray-600 mt-2">Cadastre um novo cliente ou parceiro comercial</p>
        </div>

        {/* Form */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Informações do Cliente</CardTitle>
            <CardDescription>Preencha os dados básicos do cliente</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Nome */}
              <Input
                label="Nome Completo / Razão Social *"
                placeholder="João Silva ou Empresa LTDA"
                {...register('nome')}
                error={errors.nome?.message}
              />

              {/* Email e Telefone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="email@example.com"
                  {...register('email')}
                  error={errors.email?.message}
                />

                <Input
                  label="Telefone"
                  placeholder="(11) 98765-4321"
                  mask="phone"
                  {...register('telefone')}
                  error={errors.telefone?.message}
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Cliente *</label>
                <select
                  {...register('tipo')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TIPO_OPCOES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* CPF ou CNPJ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="CPF (opcional)"
                  placeholder="000.000.000-00"
                  mask="cpf"
                  {...register('cpf')}
                  error={errors.cpf?.message}
                />

                <Input
                  label="CNPJ (opcional)"
                  placeholder="00.000.000/0000-00"
                  mask="cnpj"
                  {...register('cnpj')}
                  error={errors.cnpj?.message}
                />
              </div>

              {/* Endereço */}
              <Input
                label="Endereço (opcional)"
                placeholder="Rua, número, complemento"
                {...register('endereco')}
                error={errors.endereco?.message}
              />

              {/* Cidade e Estado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Cidade (opcional)"
                  placeholder="São Paulo"
                  {...register('cidade')}
                  error={errors.cidade?.message}
                />

                <Input
                  label="Estado (opcional)"
                  placeholder="SP"
                  maxLength={2}
                  {...register('estado')}
                  error={errors.estado?.message}
                />
              </div>

              {/* Botões */}
              <div className="flex gap-4 pt-4 border-t">
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  isLoading={isSubmitting}
                >
                  {isSubmitting ? 'Criando...' : 'Criar Cliente'}
                </Button>
                <Link href="/clientes" className="flex-1">
                  <Button variant="secondary" className="w-full">
                    Cancelar
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
