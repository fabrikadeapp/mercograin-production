'use client'

import { useEffect, useState } from 'react'
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

const schema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  cpf: z.string().optional(),
  cnh: z.string().optional(),
  cnhCategoria: z.string().optional(),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  placa: z.string().optional(),
  veiculo: z.string().optional(),
  capacidadeSc: z.string().optional(),
  transportadoraId: z.string().optional(),
  observacao: z.string().optional(),
  ativo: z.enum(['true', 'false']),
})

type FormData = z.infer<typeof schema>

const CNH_OPTS = [
  { value: '', label: '—' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'E', label: 'E' },
]

export default function NovoMotoristaPage() {
  const router = useRouter()
  const { success, error: showError } = useToast()
  const [transportadoras, setTransp] = useState<{ id: string; razaoSocial: string }[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { ativo: 'true' },
  })

  useEffect(() => {
    fetch('/api/fornecedores?tipo=transportadora&ativo=true&limit=100')
      .then((r) => r.json())
      .then((d) => setTransp(d.data || []))
      .catch(() => {})
  }, [])

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        ativo: data.ativo === 'true',
        capacidadeSc: data.capacidadeSc ? Number(data.capacidadeSc) : null,
        transportadoraId: data.transportadoraId || null,
        email: data.email || null,
      }
      const r = await fetch('/api/logistica/motoristas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const j = await r.json()
        throw new Error(j.error || 'Erro')
      }
      success('Motorista criado')
      router.push('/logistica')
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Logística · Novo registro"
        title="Novo motorista"
        subtitle="Cadastre um motorista vinculado a uma transportadora."
        actions={
          <Link href="/logistica">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>Voltar</Button>
          </Link>
        }
      />
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <section className="space-y-4">
            <p className="eyebrow">Identificação</p>
            <Input label="Nome *" {...register('nome')} error={errors.nome?.message} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="CPF" placeholder="000.000.000-00" {...register('cpf')} />
              <Input label="CNH" {...register('cnh')} />
              <Select label="Categoria CNH" options={CNH_OPTS} {...register('cnhCategoria')} />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Contato</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Telefone" {...register('telefone')} />
              <Input label="WhatsApp" {...register('whatsapp')} />
              <Input label="E-mail" type="email" {...register('email')} error={errors.email?.message} />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Veículo</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Placa" placeholder="AAA-0000" {...register('placa')} />
              <Input label="Veículo" placeholder="Volvo FH 540" {...register('veiculo')} />
              <Input label="Capacidade (sc)" type="number" {...register('capacidadeSc')} />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Vínculo</p>
            <Select
              label="Transportadora"
              options={[
                { value: '', label: '— Selecione —' },
                ...transportadoras.map((t) => ({ value: t.id, label: t.razaoSocial })),
              ]}
              {...register('transportadoraId')}
            />
            <Input label="Observação" {...register('observacao')} />
            <Select
              label="Status"
              options={[
                { value: 'true', label: 'Ativo' },
                { value: 'false', label: 'Inativo' },
              ]}
              {...register('ativo')}
            />
          </section>

          <div className="flex justify-end gap-3 pt-6 border-t border-border-1">
            <Link href="/logistica">
              <Button type="button" variant="ghost">Cancelar</Button>
            </Link>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Criando…' : 'Criar motorista'}
            </Button>
          </div>
        </form>
      </Card>
    </AppShell>
  )
}
