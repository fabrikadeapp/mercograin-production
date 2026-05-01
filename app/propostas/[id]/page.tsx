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

interface Proposta {
  id: string
  numero: string
  tipo: 'venda' | 'compra'
  status: 'rascunho' | 'enviada' | 'aceita' | 'rejeitada'
  graos: GraoItem[]
  valorTotal: number
  descricao?: string
  validadeEm: string
  criadaEm: string
  enviadaEm?: string
  cliente: {
    id: string
    nome: string
    email?: string
    telefone?: string
  }
}

export default function PropostaDetalhesPage() {
  const { id } = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { success, error: showError } = useToast()

  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
      setProposta(data)
    } catch (err) {
      showError('Erro ao carregar proposta')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    if (!proposta) return

    setSaving(true)
    try {
      const response = await fetch(`/api/propostas/${proposta.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) throw new Error('Erro ao atualizar status')
      const updated = await response.json()
      setProposta(updated)
      success('Proposta atualizada!')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao atualizar')
    } finally {
      setSaving(false)
    }
  }
  const handleDownloadPDF = async () => {
    if (!proposta) return

    try {
      const response = await fetch(`/api/propostas/${proposta.id}/pdf`)
      if (!response.ok) throw new Error('Erro ao gerar PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Proposta-${proposta.numero}.pdf`
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
          <Link href="/propostas" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Voltar para Propostas
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">PROP-{proposta.numero}</h1>
              <p className="text-gray-600 mt-2">{proposta.cliente.nome}</p>
            </div>
            <StatusBadge status={proposta.status} />
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card variant="elevated">
            <CardContent className="py-4">
              <p className="text-xs text-gray-600 mb-1">Tipo</p>
              <p className="text-lg font-semibold">{proposta.tipo === 'venda' ? '📤 Venda' : '📥 Compra'}</p>
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardContent className="py-4">
              <p className="text-xs text-gray-600 mb-1">Valor Total</p>
              <p className="text-lg font-semibold text-green-600">{formatCurrency(proposta.valorTotal)}</p>
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardContent className="py-4">
              <p className="text-xs text-gray-600 mb-1">Válida até</p>
              <p className="text-lg font-semibold">{formatDate(proposta.validadeEm)}</p>
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
                  {proposta.graos.map((grao, idx) => (
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
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {proposta.descricao && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Descrição</p>
                <p className="text-gray-900">{proposta.descricao}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 mb-1">Criada em</p>
                <p className="text-gray-900">{formatDate(proposta.criadaEm)}</p>
              </div>
              {proposta.enviadaEm && (
                <div>
                  <p className="text-gray-600 mb-1">Enviada em</p>
                  <p className="text-gray-900">{formatDate(proposta.enviadaEm)}</p>
                </div>
              )}
            </div>

            {proposta.cliente.email && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Email do Cliente</p>
                <a href={`mailto:${proposta.cliente.email}`} className="text-blue-600 hover:underline">
                  {proposta.cliente.email}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ações */}
        {proposta.status === 'rascunho' && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Ações</CardTitle>
              <CardDescription>Escolha a próxima ação para esta proposta</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3 flex-wrap">
              <Button
                variant="primary"
                onClick={() => handleStatusUpdate('enviada')}
                isLoading={saving}
              >
                ✉️ Enviar Proposta
              </Button>
              <Link href={`/propostas/${proposta.id}/editar`}>
                <Button variant="secondary">✏️ Editar</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {proposta.status === 'enviada' && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Ações</CardTitle>
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
                onClick={() => handleStatusUpdate('aceita')}
                isLoading={saving}
              >
                ✅ Marcar como Aceita
              </Button>
              <Button
                variant="danger"
                onClick={() => handleStatusUpdate('rejeitada')}
                isLoading={saving}
              >
                ❌ Marcar como Rejeitada
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
