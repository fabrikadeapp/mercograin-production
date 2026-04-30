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

interface Proposta {
  id: string
  numero: string
  tipo: 'venda' | 'compra'
  status: 'rascunho' | 'enviada' | 'aceita' | 'rejeitada'
  valorTotal: number
  validadeEm: string
  criadaEm: string
  cliente: {
    id: string
    nome: string
  }
}

export default function PropostasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { error: showError } = useToast()

  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchPropostas()
    }
  }, [status, router])

  const fetchPropostas = async () => {
    try {
      const response = await fetch('/api/propostas')
      if (!response.ok) throw new Error('Erro ao buscar propostas')
      const data = await response.json()
      setPropostas(data)
    } catch (err) {
      showError('Erro ao carregar propostas')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando propostas..." />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📄 Propostas Comerciais</h1>
              <p className="text-gray-600 mt-1">Crie e gerencie suas propostas</p>
            </div>
            <Link href="/propostas/nova">
              <Button variant="primary">+ Nova Proposta</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {propostas.length === 0 ? (
          <Card variant="elevated">
            <CardContent className="py-12">
              <EmptyState
                icon="📄"
                title="Nenhuma proposta criada"
                description="Comece criando sua primeira proposta comercial"
                action={{
                  label: 'Criar Proposta',
                  onClick: () => router.push('/propostas/nova'),
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {propostas.map((proposta) => (
              <Link key={proposta.id} href={`/propostas/${proposta.id}`}>
                <Card variant="elevated" className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">PROP-{proposta.numero}</h3>
                          <StatusBadge status={proposta.status} />
                        </div>
                        <p className="text-sm text-gray-600">{proposta.cliente.nome}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{formatCurrency(proposta.valorTotal)}</p>
                        <p className="text-xs text-gray-500">
                          {proposta.tipo === 'venda' ? '📤 Venda' : '📥 Compra'}
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-3 flex justify-between text-xs text-gray-600">
                      <span>Criada em: {formatDate(proposta.criadaEm)}</span>
                      <span>Válida até: {formatDate(proposta.validadeEm)}</span>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Link href={`/propostas/${proposta.id}`} onClick={(e) => e.preventDefault()}>
                        <Button variant="primary" size="sm" className="flex-1">
                          Ver Detalhes
                        </Button>
                      </Link>
                      {proposta.status === 'rascunho' && (
                        <Link href={`/propostas/${proposta.id}/editar`} onClick={(e) => e.preventDefault()}>
                          <Button variant="secondary" size="sm">
                            Editar
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
