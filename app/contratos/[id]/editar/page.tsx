'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormInput } from '@/components/forms/FormInput'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/contexts/ToastContext'
import { formatDate } from '@/lib/utils/formatters'

const contratoFormSchema = z.object({
  dataInicio: z.string().min(1, 'Data de início obrigatória'),
  dataFim: z.string().optional(),
  statusAssinatura: z.enum(['pendente', 'assinado', 'cancelado']),
})

type ContratoFormData = z.infer<typeof contratoFormSchema>

interface Contrato {
  id: string
  numero: string
  dataInicio: string
  dataFim?: string
  statusAssinatura: 'pendente' | 'assinado' | 'cancelado'
  criadoEm: string
  cliente: {
    id: string
    nome: string
  }
  proposta: {
    numero: string
    graos: Array<{
      grao: string
      quantidade: number
      preco: number
      subtotal: number
    }>
    valorTotal: number
    tipo: 'venda' | 'compra'
  }
}

export default function EditarContratoPage() {
  const { id } = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { success, error: showError } = useToast()

  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContratoFormData>({
    resolver: zodResolver(contratoFormSchema),
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchContrato()
    }
  }, [status, router])

  const fetchContrato = async () => {
    try {
      const response = await fetch(`/api/contratos/${id}`)
      if (!response.ok) {
        throw new Error('Contrato não encontrado')
      }
      const data: Contrato = await response.json()
      setContrato(data)

      // Converter datas para formato ISO (YYYY-MM-DD)
      const dataInicioISO = data.dataInicio.split('T')[0]
      const dataFimISO = data.dataFim ? data.dataFim.split('T')[0] : ''

      reset({
        dataInicio: dataInicioISO,
        dataFim: dataFimISO,
        statusAssinatura: data.statusAssinatura,
      })
    } catch (err) {
      showError('Erro ao carregar contrato')
      console.error(err)
      router.push('/contratos')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: ContratoFormData) => {
    if (!contrato) return

    setSubmitting(true)
    try {
      const payload = {
        dataInicio: data.dataInicio,
        dataFim: data.dataFim || null,
        statusAssinatura: data.statusAssinatura,
      }

      const response = await fetch(`/api/contratos/${contrato.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar contrato')
      }

      const updated = await response.json()
      setContrato(updated)
      success('Contrato atualizado com sucesso!')
      router.push(`/contratos/${contrato.id}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao atualizar contrato')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando contrato..." />
  }

  if (!contrato) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card variant="elevated" className="max-w-md">
          <CardContent className="py-8">
            <p className="text-center text-gray-600 mb-4">Contrato não encontrado</p>
            <Link href="/contratos" className="w-full">
              <Button variant="primary" className="w-full">
                Voltar para Contratos
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/contratos/${contrato.id}`} className="text-blue-600 hover:underline mb-4 inline-block">
            ← Voltar para Contrato
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Editar Contrato</h1>
          <p className="text-gray-600 mt-2">CTR-{contrato.numero}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Informações do Contrato */}
          <Card variant="elevated" className="mb-6">
            <CardHeader>
              <CardTitle>Informações do Contrato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Cliente</p>
                  <p className="font-semibold text-gray-900">{contrato.cliente.nome}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Proposta</p>
                  <p className="font-semibold text-gray-900">PROP-{contrato.proposta.numero}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-3">Especificação de Grãos</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 font-semibold">Grão</th>
                        <th className="text-right py-2 px-2 font-semibold">Qtd (t)</th>
                        <th className="text-right py-2 px-2 font-semibold">Preço (R$/t)</th>
                        <th className="text-right py-2 px-2 font-semibold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contrato.proposta.graos.map((grao, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-2 px-2">{grao.grao}</td>
                          <td className="text-right py-2 px-2">{grao.quantidade}</td>
                          <td className="text-right py-2 px-2">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grao.preco)}</td>
                          <td className="text-right py-2 px-2 font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(grao.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="text-sm text-gray-600 mt-4 pt-4 border-t">
                Criado em: {formatDate(contrato.criadoEm)}
              </div>
            </CardContent>
          </Card>

          {/* Detalhes para Edição */}
          <Card variant="elevated" className="mb-6">
            <CardHeader>
              <CardTitle>Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormInput
                control={control}
                name="dataInicio"
                label="Data de Início"
                type="date"
                required
              />

              <FormInput
                control={control}
                name="dataFim"
                label="Data de Término (opcional)"
                type="date"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status de Assinatura
                </label>
                <select
                  {...control.register('statusAssinatura')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pendente">Pendente</option>
                  <option value="assinado">Assinado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              {errors.dataInicio && (
                <p className="text-red-600 text-sm">{errors.dataInicio.message}</p>
              )}
              {errors.dataFim && (
                <p className="text-red-600 text-sm">{errors.dataFim.message}</p>
              )}
              {errors.statusAssinatura && (
                <p className="text-red-600 text-sm">{errors.statusAssinatura.message}</p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
            >
              ✅ Salvar Alterações
            </Button>
            <Link href={`/contratos/${contrato.id}`}>
              <Button variant="secondary">
                Cancelar
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
