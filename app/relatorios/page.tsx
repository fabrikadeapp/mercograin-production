'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { BarChart } from '@/components/charts/BarChart'
import { PieChart } from '@/components/charts/PieChart'
import { LineChart } from '@/components/charts/LineChart'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency } from '@/lib/utils/formatters'

interface RelatorioData {
  periodo: {
    mes: number
    ano: number
    dataInicio: string
    dataFim: string
  }
  graos: Array<{ grao: string; quantidade: number; valor: number }>
  propostas: Record<string, number>
  boletos: Record<string, { count: number; valor: number }>
  recebeAPorDia: Array<{ dia: number; valor: number }>
  clientesAtivos: Array<{ nome: string; propostas: number; valor: number }>
}

const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function RelatoriosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { error: showError } = useToast()

  const [relatorio, setRelatorio] = useState<RelatorioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(parseInt(searchParams.get('mes') || new Date().getMonth().toString()))
  const [ano, setAno] = useState(parseInt(searchParams.get('ano') || new Date().getFullYear().toString()))

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchRelatorio()
    }
  }, [status, router, mes, ano])

  const fetchRelatorio = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/relatorios/resumo?mes=${mes}&ano=${ano}`)
      if (!response.ok) throw new Error('Erro ao carregar relatório')
      const data = await response.json()
      setRelatorio(data)
    } catch (err) {
      showError('Erro ao carregar relatório')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleMesAnterior = () => {
    if (mes === 0) {
      setMes(11)
      setAno(ano - 1)
    } else {
      setMes(mes - 1)
    }
  }

  const handleMesProximo = () => {
    if (mes === 11) {
      setMes(0)
      setAno(ano + 1)
    } else {
      setMes(mes + 1)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen text="Gerando relatório..." />
  }

  if (!relatorio) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card variant="elevated" className="max-w-md">
          <CardContent className="py-8">
            <p className="text-center text-gray-600">Erro ao carregar relatório</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalPropostas = Object.values(relatorio.propostas).reduce((a, b) => a + b, 0)
  const totalBoletos = Object.values(relatorio.boletos).reduce((a, b) => a + b.count, 0)
  const totalArrecadado = Object.values(relatorio.boletos).reduce((a, b) => a + b.valor, 0)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">📊 Relatórios</h1>
          <p className="text-gray-600 mt-2">Análise detalhada do seu negócio</p>
        </div>

        {/* Period Selector */}
        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleMesAnterior}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
              >
                ←
              </button>

              <div className="text-center min-w-32">
                <p className="text-2xl font-bold text-gray-900">
                  {meses[mes]} {ano}
                </p>
              </div>

              <button
                onClick={handleMesProximo}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
              >
                →
              </button>
            </div>

            <button
              onClick={fetchRelatorio}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              🔄 Atualizar
            </button>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card variant="elevated">
            <CardContent className="p-6 text-center">
              <p className="text-gray-600 text-sm mb-2">Total de Propostas</p>
              <p className="text-3xl font-bold text-blue-600">{totalPropostas}</p>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="p-6 text-center">
              <p className="text-gray-600 text-sm mb-2">Boletos Criados</p>
              <p className="text-3xl font-bold text-purple-600">{totalBoletos}</p>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="p-6 text-center">
              <p className="text-gray-600 text-sm mb-2">Arrecadado</p>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(totalArrecadado)}</p>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="p-6 text-center">
              <p className="text-gray-600 text-sm mb-2">Clientes Ativos</p>
              <p className="text-3xl font-bold text-orange-600">{relatorio.clientesAtivos.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Status de Propostas */}
          <Card variant="elevated">
            <CardContent className="p-6">
              <PieChart
                title="Propostas por Status"
                data={Object.entries(relatorio.propostas).map(([status, count]) => ({
                  label: status.charAt(0).toUpperCase() + status.slice(1),
                  value: count,
                  color: {
                    rascunho: '#ef4444',
                    enviada: '#f97316',
                    aceita: '#22c55e',
                    rejeitada: '#64748b',
                  }[status] || '#3b82f6',
                }))}
              />
            </CardContent>
          </Card>

          {/* Status de Boletos */}
          <Card variant="elevated">
            <CardContent className="p-6">
              <PieChart
                title="Boletos por Status"
                data={Object.entries(relatorio.boletos).map(([status, dados]) => ({
                  label: status.charAt(0).toUpperCase() + status.slice(1),
                  value: dados.count,
                  color: {
                    aberto: '#3b82f6',
                    pago: '#22c55e',
                    vencido: '#ef4444',
                    cancelado: '#64748b',
                  }[status] || '#8b5cf6',
                }))}
              />
            </CardContent>
          </Card>
        </div>

        {/* Grãos Chart */}
        {relatorio.graos.length > 0 && (
          <Card variant="elevated" className="mb-8">
            <CardContent className="p-6">
              <BarChart
                title="Quantidade de Grãos Comercializados"
                color="#8b5cf6"
                data={relatorio.graos.map((g) => ({
                  label: g.grao,
                  value: g.quantidade,
                }))}
              />
            </CardContent>
          </Card>
        )}

        {/* Receita por Dia */}
        {relatorio.recebeAPorDia.length > 0 && (
          <Card variant="elevated" className="mb-8">
            <CardContent className="p-6">
              <LineChart
                title={`Receita Diária - ${meses[mes]} ${ano}`}
                color="#10b981"
                data={relatorio.recebeAPorDia.map((r) => ({
                  label: `Dia ${r.dia}`,
                  value: r.valor,
                }))}
              />
            </CardContent>
          </Card>
        )}

        {/* Clientes Ativos */}
        {relatorio.clientesAtivos.length > 0 && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Top Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {relatorio.clientesAtivos.map((cliente, idx) => (
                  <div key={idx} className="border-b pb-4 last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {idx + 1}. {cliente.nome}
                        </p>
                        <p className="text-sm text-gray-500">{cliente.propostas} proposta(s)</p>
                      </div>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(cliente.valor)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
