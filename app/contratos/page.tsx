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
import { formatDate } from '@/lib/utils/formatters'

interface Contrato {
  id: string
  numero: string
  statusAssinatura: 'pendente' | 'assinado' | 'cancelado'
  dataInicio: string
  dataFim: string
  cliente: {
    id: string
    nome: string
  }
  criadoEm: string
  pdfUrl?: string
}

export default function ContratosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { error: showError } = useToast()

  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchContratos()
    }
  }, [status, router])

  const fetchContratos = async () => {
    try {
      const response = await fetch('/api/contratos')
      if (!response.ok) throw new Error('Erro ao buscar contratos')
      const data = await response.json()
      setContratos(data)
    } catch (err) {
      showError('Erro ao carregar contratos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando contratos..." />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📋 Contratos</h1>
              <p className="text-gray-600 mt-1">Gerencie contratos digitais e suas assinaturas</p>
            </div>
            <Link href="/contratos/novo">
              <Button variant="primary">+ Novo Contrato</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {contratos.length === 0 ? (
          <Card variant="elevated">
            <CardContent className="py-12">
              <EmptyState
                icon="📋"
                title="Nenhum contrato criado"
                description="Comece criando seu primeiro contrato a partir de uma proposta aceita"
                action={{
                  label: 'Novo Contrato',
                  onClick: () => router.push('/contratos/novo'),
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {contratos.map((contrato) => (
              <Card key={contrato.id} variant="elevated">
                <CardContent className="py-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-gray-900">CONT-{contrato.numero}</h3>
                        <StatusBadge status={contrato.statusAssinatura} />
                      </div>
                      <p className="text-sm text-gray-600">{contrato.cliente.nome}</p>
                    </div>
                  </div>

                  <div className="border-t pt-3 flex justify-between text-xs text-gray-600">
                    <span>Vigência: {formatDate(contrato.dataInicio)} a {formatDate(contrato.dataFim)}</span>
                    <span>Criado em: {formatDate(contrato.criadoEm)}</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Link href={`/contratos/${contrato.id}`}>
                      <Button variant="primary" size="sm" className="flex-1">
                        Ver Detalhes
                      </Button>
                    </Link>
                    {contrato.pdfUrl && (
                      <a href={contrato.pdfUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="secondary" size="sm">
                          Baixar PDF
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
