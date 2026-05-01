'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FormInput } from '@/components/forms/FormInput'
import { FormSelect } from '@/components/forms/FormSelect'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'

const contratoFormSchema = z.object({
  proposIdFk: z.string().min(1, 'Selecione uma proposta'),
  dataInicio: z.string().min(1, 'Data de início obrigatória'),
  dataFim: z.string().optional(),
})

type ContratoFormData = z.infer<typeof contratoFormSchema>

interface Proposta {
  id: string
  numero: string
  cliente: {
    id: string
    nome: string
  }
  status: string
  graos: Array<{
    grao: string
    quantidade: number
    preco: number
    subtotal: number
  }>
  valorTotal: number
}

export default function NovoContratoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { success, error: showError } = useToast()

  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [selectedProposta, setSelectedProposta] = useState<Proposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const proposIdFromUrl = searchParams.get('proposIdFk')

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ContratoFormData>({
    resolver: zodResolver(contratoFormSchema),
    defaultValues: {
      proposIdFk: proposIdFromUrl || '',
      dataInicio: '',
      dataFim: '',
    },
  })

  const selectedProposIdValue = watch('proposIdFk')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchPropostas()
    }
  }, [status, router])

  useEffect(() => {
    if (propostas.length > 0 && selectedProposIdValue) {
      const proposta = propostas.find((p) => p.id === selectedProposIdValue)
      setSelectedProposta(proposta || null)
    } else {
      setSelectedProposta(null)
    }
  }, [selectedProposIdValue, propostas])

  const fetchPropostas = async () => {
    try {
      // Buscar apenas propostas aceitas
      const response = await fetch('/api/propostas?status=aceita&limit=100')
      if (!response.ok) {
        throw new Error('Erro ao buscar propostas')
      }
      const data = await response.json()
      setPropostas(data.data || [])
    } catch (err) {
      showError('Erro ao carregar propostas')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: ContratoFormData) => {
    if (!selectedProposta) {
      showError('Selecione uma proposta')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        proposIdFk: data.proposIdFk,
        clienteId: selectedProposta.cliente.id,
        numero: `CTR-${Date.now()}`,
        dataInicio: new Date(data.dataInicio),
        dataFim: data.dataFim ? new Date(data.dataFim) : null,
      }

      const response = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar contrato')
      }

      const contrato = await response.json()
      success('Contrato criado com sucesso!')
      router.push(`/contratos/${contrato.id}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar contrato')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando propostas..." />
  }

  const propostaOptions = propostas.map((p) => ({
    value: p.id,
    label: `PROP-${p.numero} - ${p.cliente.nome}`,
  }))

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link href="/contratos" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Voltar para Contratos
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Novo Contrato</h1>
          <p className="text-gray-600 mt-2">Criar contrato a partir de uma proposta aceita</p>
        </div>

        {propostas.length === 0 ? (
          <Card variant="elevated">
            <CardContent className="py-12">
              <div className="text-center">
                <p className="text-gray-600 mb-4">Nenhuma proposta aceita encontrada</p>
                <Link href="/propostas">
                  <Button variant="primary">
                    Ver Propostas
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Proposta Selection */}
            <Card variant="elevated" className="mb-6">
              <CardHeader>
                <CardTitle>Selecione a Proposta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormSelect
                  control={control}
                  name="proposIdFk"
                  label="Proposta"
                  options={propostaOptions}
                  required
                />

                {selectedProposta && (
                  <div className="mt-6 pt-6 border-t space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Cliente</p>
                        <p className="font-semibold text-gray-900">{selectedProposta.cliente.nome}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Valor Total</p>
                        <p className="font-semibold text-green-600">{formatCurrency(selectedProposta.valorTotal)}</p>
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
                            {selectedProposta.graos.map((grao, idx) => (
                              <tr key={idx} className="border-b border-gray-100">
                                <td className="py-2 px-2">{grao.grao}</td>
                                <td className="text-right py-2 px-2">{grao.quantidade}</td>
                                <td className="text-right py-2 px-2">{formatCurrency(grao.preco)}</td>
                                <td className="text-right py-2 px-2 font-semibold">{formatCurrency(grao.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contract Details */}
            <Card variant="elevated" className="mb-6">
              <CardHeader>
                <CardTitle>Datas do Contrato</CardTitle>
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

                <p className="text-sm text-gray-600">
                  ℹ️ As datas definem o período de vigência do contrato. A data de término é opcional.
                </p>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                type="submit"
                variant="primary"
                isLoading={submitting}
                disabled={!selectedProposta}
              >
                ✅ Criar Contrato
              </Button>
              <Link href="/contratos">
                <Button variant="secondary">
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
