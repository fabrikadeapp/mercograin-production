'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormInput } from '@/components/forms/FormInput'
import { FormSelect } from '@/components/forms/FormSelect'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'

const BANCOS = [
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
  cliente: {
    id: string
    nome: string
  }
  dataInicio: string
  dataFim?: string
}

export default function NovoBoletoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { success, error: showError } = useToast()

  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const contratoId = searchParams.get('contratoId')

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<BoletoFormData>({
    resolver: zodResolver(boletoFormSchema),
    defaultValues: {
      numero: '',
      banco: '',
      valor: '',
      vencimento: '',
    },
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated' && contratoId) {
      fetchContrato()
    }
  }, [status, contratoId, router])

  const fetchContrato = async () => {
    try {
      const response = await fetch(`/api/contratos/${contratoId}`)
      if (!response.ok) {
        throw new Error('Contrato não encontrado')
      }
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
    return <LoadingSpinner fullScreen text="Carregando contrato..." />
  }

  if (!contrato) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <p className="text-gray-600 mb-4">Contrato não encontrado</p>
                <Button variant="primary" onClick={() => router.push('/boletos')}>
                  Voltar para Boletos
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">💰 Novo Boleto</h1>
          <p className="text-gray-600 mt-1">Crie um boleto para cobrança</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Contrato Info */}
        <Card className="mb-6" variant="elevated">
          <CardHeader>
            <CardTitle className="text-lg">📋 Contrato de Origem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600">Número</p>
                <p className="text-lg font-bold text-gray-900">CTR-{contrato.numero}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Cliente</p>
                <p className="text-lg font-bold text-gray-900">{contrato.cliente.nome}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Início</p>
                <p className="text-sm text-gray-900">{formatDate(contrato.dataInicio)}</p>
              </div>
              {contrato.dataFim && (
                <div>
                  <p className="text-xs text-gray-600">Fim</p>
                  <p className="text-sm text-gray-900">{formatDate(contrato.dataFim)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Boleto Form */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="text-lg">Informações do Boleto</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput
                  control={control}
                  name="numero"
                  label="Número do Boleto"
                  placeholder="Ex: BOL-001"
                />
                <FormSelect
                  control={control}
                  name="banco"
                  label="Banco"
                  options={BANCOS}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput
                  control={control}
                  name="valor"
                  label="Valor (R$)"
                  placeholder="0,00"
                  type="number"
                  step="0.01"
                />
                <FormInput
                  control={control}
                  name="vencimento"
                  label="Data de Vencimento"
                  type="date"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting}
                  className="flex-1"
                >
                  {submitting ? '⏳ Criando...' : '✅ Criar Boleto'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.back()}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
