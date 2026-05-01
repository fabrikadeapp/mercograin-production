'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency } from '@/lib/utils/formatters'

interface GraoItem {
  grao: string
  quantidade: number
  preco: number
  subtotal: number
}

interface Proposta {
  id: string
  numero: string
  tipo: 'venda' | 'compra'
  status: 'rascunho' | 'enviada' | 'aceita' | 'rejeitada'
  graos: GraoItem[]
  valorTotal: number
  descricao?: string
  validadeEm: string
  clienteId: string
}

const propostaSchema = z.object({
  numero: z.string().min(1),
  tipo: z.enum(['venda', 'compra']),
  descricao: z.string().optional(),
  validadeEm: z.string().min(1),
})

type PropostaFormData = z.infer<typeof propostaSchema>

const GRAOS_DISPONIVEIS = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
  { value: 'algodao', label: 'Algodão' },
  { value: 'cafe', label: 'Café' },
  { value: 'arroz', label: 'Arroz' },
]

export default function EditarPropostaPage() {
  const { id } = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { success, error: showError } = useToast()

  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [graos, setGraos] = useState<GraoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PropostaFormData>({
    resolver: zodResolver(propostaSchema),
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchProposta()
    }
  }, [status, router])

  const fetchProposta = async () => {
    try {
      const response = await fetch(`/api/propostas/${id}`)
      if (!response.ok) throw new Error('Erro ao buscar proposta')
      const data = await response.json()

      if (data.status !== 'rascunho') {
        showError('Apenas propostas em rascunho podem ser editadas')
        router.push(`/propostas/${id}`)
        return
      }

      setProposta(data)
      setGraos(data.graos || [])
    } catch (err) {
      showError('Erro ao carregar proposta')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleGraoChange = (index: number, field: keyof GraoItem, value: string | number) => {
    setGraos((prev) => {
      const updated = [...prev]
      const grao = updated[index]

      if (field === 'quantidade' || field === 'preco') {
        const quantidade = field === 'quantidade' ? (value as number) : grao.quantidade
        const preco = field === 'preco' ? (value as number) : grao.preco

        grao[field] = value as never
        grao.subtotal = Math.round(quantidade * preco * 100) / 100
      } else {
        grao[field] = value as never
      }

      return updated
    })
  }

  const handleRemoveGrao = (index: number) => {
    setGraos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddGrao = () => {
    setGraos((prev) => [
      ...prev,
      { grao: 'soja', quantidade: 0, preco: 0, subtotal: 0 },
    ])
  }

  const valorTotal = graos.reduce((acc, g) => acc + g.subtotal, 0)

  const onSubmit = async (data: PropostaFormData) => {
    if (graos.length === 0) {
      showError('Adicione pelo menos um grão')
      return
    }

    setSaving(true)

    try {
      const payload = {
        ...data,
        graos,
        valor: valorTotal,
      }

      const response = await fetch(`/api/propostas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const res = await response.json()
        throw new Error(res.error || 'Erro ao atualizar proposta')
      }

      success('Proposta atualizada com sucesso!')
      router.push(`/propostas/${id}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao atualizar proposta')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando proposta..." />
  }

  if (!proposta) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card variant="elevated" className="max-w-md">
          <CardContent className="py-8">
            <p className="text-center text-gray-600 mb-4">Proposta não encontrada</p>
            <Link href="/propostas" className="w-full">
              <Button variant="primary" className="w-full">
                Voltar para Propostas
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/propostas/${id}`} className="text-blue-600 hover:underline mb-4 inline-block">
            ← Voltar para Proposta
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Editar Proposta PROP-{proposta.numero}</h1>
          <p className="text-gray-600 mt-2">Atualize os dados da proposta em rascunho</p>
        </div>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Detalhes da Proposta</CardTitle>
            <CardDescription>Edite as informações da proposta</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Row 1: Número e Tipo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Número da Proposta *"
                  {...register('numero')}
                  error={errors.numero?.message}
                  disabled
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                  <select
                    {...register('tipo')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="venda">Venda</option>
                    <option value="compra">Compra</option>
                  </select>
                  {errors.tipo && <p className="text-red-600 text-xs mt-1">{errors.tipo.message}</p>}
                </div>
              </div>

              {/* Validade */}
              <Input
                label="Válida até *"
                type="date"
                {...register('validadeEm')}
                error={errors.validadeEm?.message}
              />

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição / Observações
                </label>
                <textarea
                  {...register('descricao')}
                  rows={3}
                  placeholder="Detalhes adicionais da proposta"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Grãos */}
              <div className="border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Especificação de Grãos</h3>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddGrao}
                  >
                    + Adicionar Grão
                  </Button>
                </div>

                <div className="space-y-4">
                  {graos.map((grao, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-gray-50 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Grão</label>
                          <select
                            value={grao.grao}
                            onChange={(e) => handleGraoChange(index, 'grao', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {GRAOS_DISPONIVEIS.map((g) => (
                              <option key={g.value} value={g.value}>
                                {g.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Quantidade (t)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={grao.quantidade || ''}
                            onChange={(e) => handleGraoChange(index, 'quantidade', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Preço (R$/t)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={grao.preco || ''}
                            onChange={(e) => handleGraoChange(index, 'preco', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs text-gray-600">Subtotal:</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(grao.subtotal)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveGrao(index)}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="border-t pt-4 bg-blue-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Valor Total:</span>
                  <span className="text-2xl font-bold text-blue-600">{formatCurrency(valorTotal)}</span>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-4 pt-4 border-t">
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  isLoading={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar Mudanças'}
                </Button>
                <Link href={`/propostas/${id}`} className="flex-1">
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
