'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency } from '@/lib/utils/formatters'

interface DashboardStats {
  clientesTotal: number
  clientesAtivos: number
  propostasTotal: number
  propostasAbertas: number
  propostasAceitasValor: string
  boletosTotal: number
  boletosPagos: number
  boletosAbertos: number
  boletosVencidos: number
  boletosValorTotal: string
  boletosValorPago: string
  receita24h: string
  receita30d: string
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { error: showError } = useToast()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchStats()
    }
  }, [status, router])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats')
      if (!response.ok) throw new Error('Erro ao buscar estatísticas')

      const data = await response.json()
      setStats(data)
    } catch (err) {
      showError('Erro ao carregar dashboard')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando dashboard..." />
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-600">Erro ao carregar dashboard</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">📊 Dashboard</h1>
          <p className="text-gray-600 mt-1">Visão geral dos seus negócios</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Row 1: Receita */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Receita 24h */}
          <Card variant="elevated" className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <p className="text-gray-600 text-sm">Receita 24h</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {formatCurrency(parseFloat(stats.receita24h))}
              </p>
              <p className="text-xs text-gray-500 mt-2">Últimas 24 horas</p>
            </CardContent>
          </Card>

          {/* Receita 30d */}
          <Card variant="elevated" className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <p className="text-gray-600 text-sm">Receita 30 dias</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {formatCurrency(parseFloat(stats.receita30d))}
              </p>
              <p className="text-xs text-gray-500 mt-2">Últimos 30 dias</p>
            </CardContent>
          </Card>

          {/* Boletos Vencidos */}
          <Card variant="elevated" className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <p className="text-gray-600 text-sm">Boletos Vencidos</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.boletosVencidos}</p>
              <p className="text-xs text-gray-500 mt-2">Requerem ação</p>
            </CardContent>
          </Card>
        </div>

        {/* Grid: Clientes, Propostas, Boletos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Clientes */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">👥 Clientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Total</span>
                <span className="text-2xl font-bold text-gray-900">{stats.clientesTotal}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Ativos</span>
                <span className="text-lg font-semibold text-green-600">{stats.clientesAtivos}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Taxa Ativa</span>
                <span className="text-lg font-semibold">
                  {stats.clientesTotal > 0
                    ? ((stats.clientesAtivos / stats.clientesTotal) * 100).toFixed(0)
                    : 0}
                  %
                </span>
              </div>
              <Link href="/clientes" className="block mt-4">
                <Button variant="secondary" className="w-full" size="sm">
                  Ver Clientes
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Propostas */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">📋 Propostas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Total</span>
                <span className="text-2xl font-bold text-gray-900">{stats.propostasTotal}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Abertas</span>
                <span className="text-lg font-semibold text-orange-600">{stats.propostasAbertas}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Valor Aceitas</span>
                <span className="text-sm font-semibold text-green-600">
                  {formatCurrency(parseFloat(stats.propostasAceitasValor))}
                </span>
              </div>
              <Link href="/propostas" className="block mt-4">
                <Button variant="secondary" className="w-full" size="sm">
                  Ver Propostas
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Boletos */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">💰 Boletos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Total</span>
                <span className="text-2xl font-bold text-gray-900">{stats.boletosTotal}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Abertos</span>
                <span className="text-lg font-semibold text-blue-600">{stats.boletosAbertos}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pagos</span>
                <span className="text-lg font-semibold text-green-600">{stats.boletosPagos}</span>
              </div>
              <Link href="/boletos" className="block mt-4">
                <Button variant="secondary" className="w-full" size="sm">
                  Ver Boletos
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Valores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Boletos */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">Resumo Financeiro - Boletos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-600">Valor Total</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(parseFloat(stats.boletosValorTotal))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Valor Recebido</span>
                <span className="text-lg font-bold text-green-600">
                  {formatCurrency(parseFloat(stats.boletosValorPago))}
                </span>
              </div>
              {parseFloat(stats.boletosValorTotal) > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Taxa de Recebimento</span>
                    <span className="text-sm font-semibold">
                      {((parseFloat(stats.boletosValorPago) / parseFloat(stats.boletosValorTotal)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${(parseFloat(stats.boletosValorPago) / parseFloat(stats.boletosValorTotal)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Próximas Ações */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">⚡ Próximas Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.boletosVencidos > 0 && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <p className="text-sm font-medium text-red-800">
                    ⚠️ {stats.boletosVencidos} boleto(s) vencido(s)
                  </p>
                  <Link href="/boletos?status=vencido">
                    <button className="text-xs text-red-600 hover:text-red-700 font-medium mt-1">
                      Ver boletos vencidos →
                    </button>
                  </Link>
                </div>
              )}

              {stats.propostasAbertas > 0 && (
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <p className="text-sm font-medium text-orange-800">
                    📋 {stats.propostasAbertas} proposta(s) pendente(s)
                  </p>
                  <Link href="/propostas?status=rascunho">
                    <button className="text-xs text-orange-600 hover:text-orange-700 font-medium mt-1">
                      Ver propostas abertas →
                    </button>
                  </Link>
                </div>
              )}

              {stats.boletosVencidos === 0 && stats.propostasAbertas === 0 && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-800">
                    ✅ Tudo em dia!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
