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
  tipo: z.enum(['silo', 'granel', 'horizontal', 'misto']),
  capacidadeSc: z.coerce.number().int().nonnegative(),
  proprio: z.enum(['true', 'false']),
  fornecedorId: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().max(2).optional(),
  cep: z.string().optional(),
  contato: z.string().optional(),
  telefone: z.string().optional(),
  observacao: z.string().optional(),
  ativo: z.enum(['true', 'false']),
})

type FormData = z.infer<typeof schema>

const TIPO_OPTS = [
  { value: 'silo', label: 'Silo' },
  { value: 'granel', label: 'Granel' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'misto', label: 'Misto' },
]

export default function NovoArmazemPage() {
  const router = useRouter()
  const { success, error: showError } = useToast()
  const [fornecedores, setFornecedores] = useState<{ id: string; razaoSocial: string }[]>([])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { proprio: 'true', ativo: 'true', tipo: 'silo' },
  })

  const proprio = watch('proprio')

  useEffect(() => {
    fetch('/api/fornecedores?tipo=armazem&ativo=true&limit=100')
      .then((r) => r.json())
      .then((d) => setFornecedores(d.data || []))
      .catch(() => {})
  }, [])

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        proprio: data.proprio === 'true',
        ativo: data.ativo === 'true',
        fornecedorId: data.proprio === 'true' ? null : data.fornecedorId || null,
      }
      const r = await fetch('/api/logistica/armazens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const j = await r.json()
        throw new Error(j.error || 'Erro')
      }
      success('Armazém criado')
      router.push('/logistica')
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro ao criar armazém')
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Logística · Novo registro"
        title="Novo armazém"
        subtitle="Cadastre um armazém próprio ou terceirizado."
        actions={
          <Link href="/logistica">
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
            <Input label="Nome *" {...register('nome')} error={errors.nome?.message} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label="Tipo *" options={TIPO_OPTS} {...register('tipo')} error={errors.tipo?.message} />
              <Input
                label="Capacidade (sc 60kg) *"
                type="number"
                {...register('capacidadeSc')}
                error={errors.capacidadeSc?.message}
              />
              <Select
                label="Modalidade"
                options={[
                  { value: 'true', label: 'Próprio' },
                  { value: 'false', label: 'Terceirizado' },
                ]}
                {...register('proprio')}
              />
            </div>
            {proprio === 'false' && (
              <Select
                label="Fornecedor (armazém terceirizado)"
                options={[
                  { value: '', label: '— Selecione —' },
                  ...fornecedores.map((f) => ({ value: f.id, label: f.razaoSocial })),
                ]}
                {...register('fornecedorId')}
              />
            )}
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Localização</p>
            <Input label="Endereço" {...register('endereco')} />
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Input label="Cidade" {...register('cidade')} />
              </div>
              <Input label="UF" maxLength={2} {...register('uf')} />
            </div>
            <Input label="CEP" {...register('cep')} />
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Contato</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Contato" {...register('contato')} />
              <Input label="Telefone" {...register('telefone')} />
            </div>
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
              {isSubmitting ? 'Criando…' : 'Criar armazém'}
            </Button>
          </div>
        </form>
      </Card>
    </AppShell>
  )
}
