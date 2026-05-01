'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'

interface Boleto {
  id: string
  numero: string
  valor: string
  vencimento: string
  status: 'aberto' | 'pago' | 'vencido' | 'cancelado'
  banco: string
  linkBoleto?: string
  braspagId?: string
  confirmadoEm?: string
  criadoEm: string
  cliente: {
    id: string
    nome: string
    cnpj?: string
    email?: string
  }
  contrato?: {
    id: string
    numero: string
  }
}

export default function DetalheBoletoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const { success, error: showError, info } = useToast()

  const [boleto, setBoleto] = useState<Boleto | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const boletoId = params.id as string

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchBoleto()
    }
  }, [status, boletoId, router])

  const fetchBoleto = async () => {
    try {
      const response = await fetch(`/api/boletos/${boletoId}`)
      if (!response.ok) {
        throw new Error('Boleto não encontrado')
      }
      const data = await response.json()
      setBoleto(data)
    } catch (err) {
      showError('Erro ao carregar boleto')
      console.error(err)
      router.push('/boletos')
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshStatus = async () => {
    if (!boleto?.braspagId) {
      info('Boleto ainda não foi registrado no Braspag')
      return
    }

    setRefreshing(true)
    try {
      const response = await fetch(`/api/boletos/${boletoId}/refresh-status`, {
        method: 'PATCH',
      })

      if (!response.ok) {
        throw new Error('Erro ao atualizar status')
      }

      const updatedBoleto = await response.json()
      setBoleto(updatedBoleto)
      success('Status atualizado com sucesso!')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao atualizar status')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando boleto..." />
  }

  if (!boleto) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <p className="text-gray-600 mb-4">Boleto não encontrado</p>
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

  const valorDecimal = parseFloat(boleto.valor)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">💰 Boleto {boleto.numero}</h1>
              <p className="text-gray-600 mt-1">Detalhes de cobrança</p>
            </div>
            <StatusBadge status={boleto.status} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Valor Principal */}
        <Card className="mb-6 border-2 border-green-200" variant="elevated">
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-gray-600 mb-2">Valor Total</p>
              <p className="text-5xl font-bold text-green-600">{formatCurrency(valorDecimal)}</p>
              <p className="text-sm text-gray-500 mt-2">Banco: {boleto.banco}</p>
            </div>
          </CardContent>
        </Card>

        {/* Informações Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Info Boleto */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">📄 Informações do Boleto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-gray-600">Número</p>
                <p className="text-sm font-mono text-gray-900">{boleto.numero}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Vencimento</p>
                <p className="text-sm font-bold text-gray-900">{formatDate(boleto.vencimento)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Criado em</p>
                <p className="text-sm text-gray-600">{formatDate(boleto.criadoEm)}</p>
              </div>
              {boleto.confirmadoEm && (
                <div>
                  <p className="text-xs text-gray-600">✅ Pago em</p>
                  <p className="text-sm text-green-600 font-bold">{formatDate(boleto.confirmadoEm)}</p>
                </div>
              )}
              {boleto.braspagId && (
                <div>
                  <p className="text-xs text-gray-600">ID Braspag</p>
                  <p className="text-xs font-mono text-gray-500">{boleto.braspagId}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Cliente */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">👤 Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-gray-600">Nome</p>
                <p className="text-sm font-bold text-gray-900">{boleto.cliente.nome}</p>
              </div>
              {boleto.cliente.cnpj && (
                <div>
                  <p className="text-xs text-gray-600">CNPJ</p>
                  <p className="text-sm font-mono text-gray-600">{boleto.cliente.cnpj}</p>
                </div>
              )}
              {boleto.cliente.email && (
                <div>
                  <p className="text-xs text-gray-600">Email</p>
                  <p className="text-sm text-blue-600">
                    <a href={`mailto:${boleto.cliente.email}`}>{boleto.cliente.email}</a>
                  </p>
                </div>
              )}
              {boleto.contrato && (
                <div>
                  <p className="text-xs text-gray-600">Contrato de Origem</p>
                  <Link href={`/contratos/${boleto.contrato.id}`}>
                    <p className="text-sm text-blue-600 hover:underline">CTR-{boleto.contrato.numero}</p>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Links de Ação */}
        <Card className="mb-6" variant="elevated">
          <CardHeader>
            <CardTitle className="text-lg">🔗 Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {boleto.linkBoleto ? (
                <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div>
                    <p className="text-sm font-bold text-gray-900">📥 Boleto Disponível</p>
                    <p className="text-xs text-gray-600">Clique para baixar ou imprimir</p>
                  </div>
                  <a href={boleto.linkBoleto} target="_blank" rel="noopener noreferrer">
                    <Button variant="primary" size="sm">
                      Abrir Boleto
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div>
                    <p className="text-sm font-bold text-gray-900">⏳ Boleto Pendente</p>
                    <p className="text-xs text-gray-600">Link do boleto será gerado em breve</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="text-lg">⚡ Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button
                variant="secondary"
                onClick={handleRefreshStatus}
                disabled={refreshing || !boleto.braspagId}
                className="w-full sm:w-auto"
              >
                {refreshing ? '⏳ Atualizando...' : '🔄 Atualizar Status'}
              </Button>
              <div className="text-xs text-gray-500 mt-2">
                O status é atualizado automaticamente via webhook quando o boleto é pago.
                Clique aqui para verificar manualmente no Braspag.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          <Button variant="secondary" onClick={() => router.back()}>
            ← Voltar
          </Button>
          <Link href="/boletos">
            <Button variant="secondary">
              Ver Todos os Boletos
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
