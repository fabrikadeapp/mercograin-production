'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { formatDate } from '@/lib/utils/formatters'

const BANCOS = [
  { value: '', label: 'Selecione um banco' },
  { value: 'Itaú', label: 'Itaú' },
  { value: 'Bradesco', label: 'Bradesco' },
  { value: 'Santander', label: 'Santander' },
  { value: 'Caixa', label: 'Caixa' },
  { value: 'Sicredi', label: 'Sicredi' },
  { value: 'Nu Bank', label: 'Nu Bank' },
  { value: 'C6 Bank', label: 'C6 Bank' },
]

const boletoFormSchema = z.object({
  numero: z.string().min(1, 'Número obrigatório'),
  banco: z.string().min(1, 'Selecione um banco'),
  valor: z.string().min(1, 'Valor obrigatório'),
  vencimento: z.string().min(1, 'Data de vencimento obrigatória'),
})

type BoletoFormData = z.infer<typeof boletoFormSchema>

interface Contrato {
  id: string
  numero: string
  cliente: { id: string; nome: string }
  dataInicio: string
  dataFim?: string
}

export default function NovoBoletoPage() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { success, error: showError } = useToast()

  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const contratoId = searchParams.get('contratoId')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BoletoFormData>({
    resolver: zodResolver(boletoFormSchema),
    defaultValues: { numero: '', banco: '', valor: '', vencimento: '' },
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated' && contratoId) fetchContrato()
  }, [status, contratoId, router])

  const fetchContrato = async () => {
    try {
      const response = await fetch(`/api/contratos/${contratoId}`)
      if (!response.ok) throw new Error('Contrato não encontrado')
      const data = await response.json()
      setContrato(data)
    } catch (err) {
      showError('Erro ao carregar contrato')
      console.error(err)
      router.push('/boletos')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: BoletoFormData) => {
    if (!contrato) {
      showError('Contrato não selecionado')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/boletos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: data.numero,
          banco: data.banco,
          valor: parseFloat(data.valor),
          vencimento: data.vencimento,
          clienteId: contrato.cliente.id,
          contratoId: contrato.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar boleto')
      }

      const boleto = await response.json()
      success(`Boleto ${boleto.numero} criado com sucesso!`)
      router.push(`/boletos/${boleto.id}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar boleto')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-fg-3 text-small gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando contrato…
        </div>
      </AppShell>
    )
  }

  if (!contrato) {
    return (
      <AppShell>
        <Card className="max-w-md mx-auto text-center space-y-4 my-12">
          <p className="eyebrow text-neg">Não encontrado</p>
          <h2 className="text-h2 font-sans tracking-tight text-fg-1">Contrato não encontrado</h2>
          <Link href="/boletos">
            <Button fullWidth>Voltar para boletos</Button>
          </Link>
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Financeiro · Novo boleto"
        title="Novo boleto"
        subtitle="Gere uma cobrança a partir de um contrato existente."
        search={false}
        actions={
          <Link href="/boletos">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />

      <div className="space-y-6">
        <Card className="space-y-4">
          <p className="eyebrow">Contrato de origem</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-fg-3 text-micro uppercase tracking-wider">Número</p>
              <p className="text-fg-1 font-semibold t-num mt-1">CTR-{contrato.numero}</p>
            </div>
            <div>
              <p className="text-fg-3 text-micro uppercase tracking-wider">Cliente</p>
              <p className="text-fg-1 font-semibold mt-1">{contrato.cliente.nome}</p>
            </div>
            <div>
              <p className="text-fg-3 text-micro uppercase tracking-wider">Início</p>
              <p className="text-fg-1 t-num text-small mt-1">{formatDate(contrato.dataInicio)}</p>
            </div>
            {contrato.dataFim && (
              <div>
                <p className="text-fg-3 text-micro uppercase tracking-wider">Fim</p>
                <p className="text-fg-1 t-num text-small mt-1">{formatDate(contrato.dataFim)}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <section className="space-y-4">
              <p className="eyebrow">Dados do boleto</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Número do boleto"
                  placeholder="Ex: BOL-001"
                  {...register('numero')}
                  error={errors.numero?.message}
                />
                <Select
                  label="Banco"
                  options={BANCOS}
                  {...register('banco')}
                  error={errors.banco?.message}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Valor (R$)"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  {...register('valor')}
                  error={errors.valor?.message}
                />
                <Input
                  label="Vencimento"
                  type="date"
                  {...register('vencimento')}
                  error={errors.vencimento?.message}
                />
              </div>
            </section>

            <div className="flex justify-end gap-3 pt-6 border-t border-border-1">
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit" loading={submitting}>
                {submitting ? 'Criando…' : 'Criar boleto'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  )
}
