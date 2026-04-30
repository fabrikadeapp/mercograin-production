'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency, formatDate } from '@/lib/utils/formatters'

interface Boleto {
  id: string
  numero: string
  banco: string
  valor: number
  vencimento: string
  status: 'aberto' | 'pago' | 'vencido' | 'cancelado'
  linkBoleto?: string
  cliente: {
    id: string
    nome: string
  }
  criadoEm: string
}

export default function BoletosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { error: showError } = useToast()

  const [boletos, setBoletos] = useState<Boleto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchBoletos()
    }
  }, [status, router])

  const fetchBoletos = async () => {
    try {
      const response = await fetch('/api/boletos')
      if (!response.ok) throw new Error('Erro ao buscar boletos')
      const data = await response.json()
      setBoletos(data)
    } catch (err) {
      showError('Erro ao carregar boletos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando boletos..." />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">💰 Boletos</h1>
              <p className="text-gray-600 mt-1">Gerencie cobranças e boletos de clientes</p>
            </div>
            <Link href="/boletos/novo">
              <Button variant="primary">+ Novo Boleto</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {boletos.length === 0 ? (
          <Card variant="elevated">
            <CardContent className="py-12">
              <EmptyState
                icon="💰"
                title="Nenhum boleto criado"
                description="Comece criando seu primeiro boleto a partir de um contrato"
                action={{
                  label: 'Novo Boleto',
                  onClick: () => router.push('/boletos/novo'),
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {boletos.map((boleto) => (
              <Card key={boleto.id} variant="elevated">
                <CardContent className="py-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-gray-900">BOL-{boleto.numero}</h3>
                        <StatusBadge status={boleto.status} />
                      </div>
                      <p className="text-sm text-gray-600">{boleto.cliente.nome}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(boleto.valor)}</p>
                      <p className="text-xs text-gray-500">Banco: {boleto.banco}</p>
                    </div>
                  </div>

                  <div className="border-t pt-3 flex justify-between text-xs text-gray-600">
                    <span>Criado em: {formatDate(boleto.criadoEm)}</span>
                    <span>Vencimento: {formatDate(boleto.vencimento)}</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Link href={`/boletos/${boleto.id}`}>
                      <Button variant="primary" size="sm" className="flex-1">
                        Ver Detalhes
                      </Button>
                    </Link>
                    {boleto.linkBoleto && (
                      <a href={boleto.linkBoleto} target="_blank" rel="noopener noreferrer">
                        <Button variant="secondary" size="sm">
                          Baixar Boleto
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
