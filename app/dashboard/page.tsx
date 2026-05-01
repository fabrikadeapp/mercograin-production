'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'

interface DashboardStats {
  summary: {
    clientes: number
    propostas: number
    contratos: number
    boletos: number
  }
  propostas: {
    total: number
    porStatus: Record<string, number>
    valorTotal: number
  }
  contratos: {
    total: number
    porStatus: Record<string, number>
  }
  boletos: {
    total: number
    porStatus: Record<string, number>
    arrecadado: number
    aberto: number
  }
  activity: {
    ultimasPropostas: Array<{
      id: string
      numero: string
      cliente: string
      status: string
      valor: number
      data: string
    }>
    ultimosContratos: Array<{
      id: string
      numero: string
      proposta: string
      cliente: string
      status: string
      data: string
    }>
    ultimosBoletos: Array<{
      id: string
      numero: string
      cliente: string
      valor: number
      status: string
      vencimento: string
      data: string
    }>
  }
  alerts: {
    boletosVencidos: Array<{
      id: string
      numero: string
      cliente: string
      valor: number
      vencimento: string
    }>
    propostasPendentes: Array<{
      id: string
      numero: string
      cliente: string
      validadeEm: string
    }>
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
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
    setLoading(true)
    try {
      const response = await fetch('/api/dashboard/stats')
      if (!response.ok) throw new Error('Erro ao carregar estatísticas')

      const data: DashboardStats = await response.json()
      setStats(data)
    } catch (err) {
      console.error('Error fetching stats:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📊 Dashboard</h1>
              <p className="text-gray-600 mt-1">Visão geral do seu negócio</p>
            </div>
            <button
              onClick={fetchStats}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔄 Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link href="/clientes">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-blue-600">
                  {stats.summary.clientes}
                </div>
                <p className="text-gray-600 mt-2 font-medium">Clientes</p>
                <p className="text-gray-500 text-sm mt-1">👥 Cadastrados</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/propostas">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-purple-600">
                  {stats.summary.propostas}
                </div>
                <p className="text-gray-600 mt-2 font-medium">Propostas</p>
                <p className="text-gray-500 text-sm mt-1">
                  {formatCurrency(Number(stats.propostas.valorTotal) || 0)}
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/contratos">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-green-600">
                  {stats.summary.contratos}
                </div>
                <p className="text-gray-600 mt-2 font-medium">Contratos</p>
                <p className="text-gray-500 text-sm mt-1">🤝 Assinados</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/boletos">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-orange-600">
                  {stats.summary.boletos}
                </div>
                <p className="text-gray-600 mt-2 font-medium">Boletos</p>
                <p className="text-gray-500 text-sm mt-1">
                  {formatCurrency(stats.boletos.arrecadado)}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Alerts */}
        {(stats.alerts.boletosVencidos.length > 0 || stats.alerts.propostasPendentes.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Boletos Vencidos */}
            {stats.alerts.boletosVencidos.length > 0 && (
              <Card className="border-l-4 border-l-red-600 bg-red-50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-2xl">🚨</span>
                    <div>
                      <h3 className="text-lg font-bold text-red-900">Boletos Vencidos</h3>
                      <p className="text-sm text-red-700">{stats.alerts.boletosVencidos.length} boleto(s) vencido(s)</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {stats.alerts.boletosVencidos.map((boleto) => (
                      <Link key={boleto.id} href={`/boletos/${boleto.id}`}>
                        <div className="p-2 bg-white rounded border border-red-200 hover:bg-red-100 transition-colors cursor-pointer">
                          <p className="font-semibold text-red-900">BLT-{boleto.numero}</p>
                          <p className="text-sm text-gray-600">{boleto.cliente}</p>
                          <p className="text-sm font-bold text-red-600">{formatCurrency(boleto.valor)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Link href="/boletos?status=vencido" className="block mt-4">
                    <Button variant="primary" size="sm" className="w-full">
                      Ver Todos os Vencidos
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Propostas Pendentes */}
            {stats.alerts.propostasPendentes.length > 0 && (
              <Card className="border-l-4 border-l-orange-600 bg-orange-50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-2xl">⏳</span>
                    <div>
                      <h3 className="text-lg font-bold text-orange-900">Propostas Pendentes</h3>
                      <p className="text-sm text-orange-700">{stats.alerts.propostasPendentes.length} proposta(s) aguardando resposta</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {stats.alerts.propostasPendentes.map((proposta) => (
                      <Link key={proposta.id} href={`/propostas/${proposta.id}`}>
                        <div className="p-2 bg-white rounded border border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer">
                          <p className="font-semibold text-orange-900">PROP-{proposta.numero}</p>
                          <p className="text-sm text-gray-600">{proposta.cliente}</p>
                          <p className="text-sm text-orange-600">Válida até: {formatDate(new Date(proposta.validadeEm))}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Link href="/propostas?status=enviada" className="block mt-4">
                    <Button variant="primary" size="sm" className="w-full">
                      Ver Todas as Pendentes
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Status Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Propostas Status */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Status Propostas</h3>
              <div className="space-y-3">
                {Object.entries(stats.propostas.porStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <StatusBadge status={status} />
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Contratos Status */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Status Contratos</h3>
              <div className="space-y-3">
                {Object.entries(stats.contratos.porStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <StatusBadge status={status} />
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Boletos Status */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Status Boletos</h3>
              <div className="space-y-3">
                {Object.entries(stats.boletos.porStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <StatusBadge status={status} />
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Arrecadado:</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(stats.boletos.arrecadado)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Em aberto:</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(stats.boletos.aberto)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Últimas Propostas */}
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Últimas Propostas</h3>
                <Link href="/propostas" className="text-blue-600 hover:underline text-sm">
                  Ver tudo →
                </Link>
              </div>
              <div className="space-y-3">
                {stats.activity.ultimasPropostas.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nenhuma proposta ainda</p>
                ) : (
                  stats.activity.ultimasPropostas.map((prop) => (
                    <Link key={prop.id} href={`/propostas/${prop.id}`}>
                      <div className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{prop.numero}</p>
                            <p className="text-sm text-gray-600">{prop.cliente}</p>
                          </div>
                          <StatusBadge status={prop.status} />
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-500">
                            {formatDate(new Date(prop.data))}
                          </span>
                          <span className="font-bold text-gray-900">
                            {formatCurrency(prop.valor)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Últimos Boletos */}
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Últimos Boletos</h3>
                <Link href="/boletos" className="text-blue-600 hover:underline text-sm">
                  Ver tudo →
                </Link>
              </div>
              <div className="space-y-3">
                {stats.activity.ultimosBoletos.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Nenhum boleto ainda</p>
                ) : (
                  stats.activity.ultimosBoletos.map((boleto) => (
                    <Link key={boleto.id} href={`/boletos/${boleto.id}`}>
                      <div className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{boleto.numero}</p>
                            <p className="text-sm text-gray-600">{boleto.cliente}</p>
                          </div>
                          <StatusBadge status={boleto.status} />
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-500">
                            Venc. {formatDate(new Date(boleto.vencimento))}
                          </span>
                          <span className="font-bold text-gray-900">
                            {formatCurrency(boleto.valor)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
