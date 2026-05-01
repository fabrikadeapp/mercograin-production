'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'

interface GraoItem {
  grao: string
  quantidade: number
  preco: number
  subtotal: number
}

interface Contrato {
  id: string
  numero: string
  statusAssinatura: 'pendente' | 'assinado' | 'cancelado'
  dataInicio: string
  dataFim?: string
  assinadoEm?: string
  pdfUrl?: string
  criadoEm: string
  cliente: {
    id: string
    nome: string
    email?: string
    cnpj?: string
  }
  proposta: {
    numero: string
    graos: GraoItem[]
    valorTotal: number
    tipo: 'venda' | 'compra'
  }
}

export default function ContratoDetalhesPage() {
  const { id } = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { success, error: showError } = useToast()

  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
      if (!response.ok) throw new Error('Erro ao buscar contrato')
      const data = await response.json()
      setContrato(data)
    } catch (err) {
      showError('Erro ao carregar contrato')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    if (!contrato) return

    setSaving(true)
    try {
      const response = await fetch(`/api/contratos/${contrato.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusAssinatura: newStatus }),
      })

      if (!response.ok) throw new Error('Erro ao atualizar status')
      const updated = await response.json()
      setContrato(updated)
      success('Contrato atualizado!')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao atualizar')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!contrato) return

    try {
      const response = await fetch(`/api/contratos/${contrato.id}/pdf`)
      if (!response.ok) throw new Error('Erro ao gerar PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Contrato-${contrato.numero}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      success('PDF baixado com sucesso!')
    } catch (err) {
      showError('Erro ao baixar PDF')
      console.error(err)
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
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link href="/contratos" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Voltar para Contratos
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">CTR-{contrato.numero}</h1>
              <p className="text-gray-600 mt-2">{contrato.cliente.nome}</p>
            </div>
            <StatusBadge status={contrato.statusAssinatura} />
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card variant="elevated">
            <CardContent className="py-4">
              <p className="text-xs text-gray-600 mb-1">Proposta Relacionada</p>
              <p className="text-lg font-semibold">PROP-{contrato.proposta.numero}</p>
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardContent className="py-4">
              <p className="text-xs text-gray-600 mb-1">Valor Total</p>
              <p className="text-lg font-semibold text-green-600">{formatCurrency(Number(contrato.proposta.valorTotal))}</p>
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardContent className="py-4">
              <p className="text-xs text-gray-600 mb-1">Tipo</p>
              <p className="text-lg font-semibold">{contrato.proposta.tipo === 'venda' ? '📤 Venda' : '📥 Compra'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Grãos */}
        <Card variant="elevated" className="mb-8">
          <CardHeader>
            <CardTitle>Especificação de Grãos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold">Grão</th>
                    <th className="text-right py-2 px-3 font-semibold">Quantidade (t)</th>
                    <th className="text-right py-2 px-3 font-semibold">Preço (R$/t)</th>
                    <th className="text-right py-2 px-3 font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {contrato.proposta.graos.map((grao, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2 px-3">{grao.grao}</td>
                      <td className="text-right py-2 px-3">{grao.quantidade}</td>
                      <td className="text-right py-2 px-3">{formatCurrency(grao.preco)}</td>
                      <td className="text-right py-2 px-3 font-semibold">{formatCurrency(grao.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Detalhes */}
        <Card variant="elevated" className="mb-8">
          <CardHeader>
            <CardTitle>Detalhes do Contrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 mb-1">Data de Início</p>
                <p className="text-gray-900">{formatDate(contrato.dataInicio)}</p>
              </div>
              {contrato.dataFim && (
                <div>
                  <p className="text-gray-600 mb-1">Data de Fim</p>
                  <p className="text-gray-900">{formatDate(contrato.dataFim)}</p>
                </div>
              )}
              {contrato.assinadoEm && (
                <div>
                  <p className="text-gray-600 mb-1">Assinado em</p>
                  <p className="text-gray-900">{formatDate(contrato.assinadoEm)}</p>
                </div>
              )}
              <div>
                <p className="text-gray-600 mb-1">Criado em</p>
                <p className="text-gray-900">{formatDate(contrato.criadoEm)}</p>
              </div>
            </div>

            {contrato.cliente.cnpj && (
              <div>
                <p className="text-sm text-gray-600 mb-1">CNPJ do Cliente</p>
                <p className="text-gray-900">{contrato.cliente.cnpj}</p>
              </div>
            )}

            {contrato.cliente.email && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Email do Cliente</p>
                <a href={`mailto:${contrato.cliente.email}`} className="text-blue-600 hover:underline">
                  {contrato.cliente.email}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ações */}
        {contrato.statusAssinatura === 'pendente' && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Ações</CardTitle>
              <CardDescription>Escolha a próxima ação para este contrato</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3 flex-wrap">
              <Button
                variant="secondary"
                onClick={handleDownloadPDF}
              >
                📄 Baixar PDF
              </Button>
              <Button
                variant="primary"
                onClick={() => handleStatusUpdate('assinado')}
                isLoading={saving}
              >
                ✅ Marcar como Assinado
              </Button>
              <Button
                variant="danger"
                onClick={() => handleStatusUpdate('cancelado')}
                isLoading={saving}
              >
                ❌ Cancelar Contrato
              </Button>
            </CardContent>
          </Card>
        )}

        {contrato.statusAssinatura === 'assinado' && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Contrato Assinado</CardTitle>
              <CardDescription>Este contrato foi assinado e está em vigor</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3 flex-wrap">
              <Button
                variant="secondary"
                onClick={handleDownloadPDF}
              >
                📄 Baixar PDF
              </Button>
              <Link href={`/boletos/novo?contratoId=${contrato.id}`}>
                <Button variant="primary">
                  💰 Criar Boleto
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {contrato.statusAssinatura === 'cancelado' && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Contrato Cancelado</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3 flex-wrap">
              <Button
                variant="secondary"
                onClick={handleDownloadPDF}
              >
                📄 Baixar PDF
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
