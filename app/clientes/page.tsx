'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/contexts/ToastContext'
import { formatDate } from '@/lib/utils/formatters'

interface Cliente {
  id: string
  nome: string
  email?: string
  telefone?: string
  tipo: 'comprador' | 'vendedor' | 'ambos'
  ativo: boolean
  criadaEm: string
}

export default function ClientesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { success, error: showError } = useToast()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchClientes()
    }
  }, [status, router])

  const fetchClientes = async () => {
    try {
      const response = await fetch('/api/clientes')
      if (!response.ok) throw new Error('Erro ao buscar clientes')
      const data = await response.json()
      setClientes(data)
    } catch (err) {
      showError('Erro ao carregar clientes')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Deseja deletar o cliente "${nome}"?`)) return

    try {
      const response = await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erro ao deletar')

      setClientes(clientes.filter((c) => c.id !== id))
      success('Cliente deletado com sucesso')
    } catch (err) {
      showError('Erro ao deletar cliente')
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando clientes..." />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">👥 Clientes</h1>
              <p className="text-gray-600 mt-1">Gerencie seus clientes e parceiros comerciais</p>
            </div>
            <Link href="/clientes/novo">
              <Button variant="primary">+ Novo Cliente</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {clientes.length === 0 ? (
          <Card variant="elevated">
            <CardContent className="py-12">
              <EmptyState
                icon="👥"
                title="Nenhum cliente cadastrado"
                description="Comece adicionando seu primeiro cliente"
                action={{
                  label: 'Novo Cliente',
                  onClick: () => router.push('/clientes/novo'),
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <Card variant="elevated">
            <CardContent className="p-0">
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableRow isHeader>
                      <TableHeaderCell>Nome</TableHeaderCell>
                      <TableHeaderCell>Email</TableHeaderCell>
                      <TableHeaderCell>Telefone</TableHeaderCell>
                      <TableHeaderCell>Tipo</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell>Criado em</TableHeaderCell>
                      <TableHeaderCell className="text-right">Ações</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {clientes.map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-semibold">{cliente.nome}</TableCell>
                        <TableCell className="text-sm">{cliente.email || '-'}</TableCell>
                        <TableCell className="text-sm">{cliente.telefone || '-'}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {cliente.tipo === 'ambos' ? 'Comprador/Vendedor' : cliente.tipo}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={cliente.ativo ? 'ativo' : 'inativo'} />
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(cliente.criadaEm)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Link href={`/clientes/${cliente.id}/editar`}>
                              <Button variant="secondary" size="sm">
                                Editar
                              </Button>
                            </Link>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(cliente.id, cliente.nome)}
                            >
                              Deletar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden space-y-3 p-4">
                {clientes.map((cliente) => (
                  <div key={cliente.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{cliente.nome}</h3>
                        <p className="text-xs text-gray-600 mt-1">
                          {cliente.tipo === 'ambos' ? 'Comprador/Vendedor' : cliente.tipo}
                        </p>
                      </div>
                      <StatusBadge status={cliente.ativo ? 'ativo' : 'inativo'} />
                    </div>

                    {cliente.email && <p className="text-xs text-gray-600 mb-1">📧 {cliente.email}</p>}
                    {cliente.telefone && <p className="text-xs text-gray-600 mb-2">📱 {cliente.telefone}</p>}
                    <p className="text-xs text-gray-500 mb-3">Criado em: {formatDate(cliente.criadaEm)}</p>

                    <div className="flex gap-2">
                      <Link href={`/clientes/${cliente.id}/editar`} className="flex-1">
                        <Button variant="secondary" size="sm" className="w-full">
                          Editar
                        </Button>
                      </Link>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(cliente.id, cliente.nome)}
                      >
                        Deletar
                      </Button>
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
