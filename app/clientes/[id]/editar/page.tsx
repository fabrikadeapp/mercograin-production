'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
} from '@/components/ui/phb'

interface Cliente {
  id: string
  nome: string
  email?: string
  telefone?: string
  cnpj?: string
  cpf?: string
  endereco?: string
  cidade?: string
  estado?: string
  tipo: 'comprador' | 'vendedor'
}

const TIPO_OPCOES = [
  { value: 'comprador', label: 'Comprador' },
  { value: 'vendedor', label: 'Vendedor' },
]

export default function EditarClientePage() {
  const router = useRouter()
  const params = useParams()
  const clienteId = params.id as string

  const [formData, setFormData] = useState<Partial<Cliente>>({
    nome: '',
    email: '',
    telefone: '',
    cnpj: '',
    cpf: '',
    endereco: '',
    cidade: '',
    estado: '',
    tipo: 'comprador',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchCliente()
  }, [clienteId])

  const fetchCliente = async () => {
    try {
      const response = await fetch(`/api/clientes/${clienteId}`)
      if (!response.ok) throw new Error('Cliente não encontrado')
      const data = await response.json()
      setFormData(data)
      setError('')
    } catch (err) {
      setError('Erro ao carregar cliente')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setUpdating(true)

    try {
      const response = await fetch(`/api/clientes/${clienteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao atualizar cliente')
      }

      router.push('/clientes')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar cliente')
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-fg-3 text-small gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando cliente…
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Cadastro · Edição"
        title="Editar cliente"
        subtitle={formData.nome || ''}
        search={false}
        actions={
          <Link href="/clientes">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />

      <Card>
        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-md border border-l-2 border-border-1 border-l-neg bg-bg-2 p-3 text-small text-fg-1">
            <AlertCircle className="h-4 w-4 text-neg shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-4">
            <p className="eyebrow">Identificação</p>
            <Input
              label="Nome completo · Razão social *"
              name="nome"
              value={formData.nome || ''}
              onChange={handleChange}
              required
            />
            <Select
              label="Tipo *"
              name="tipo"
              value={formData.tipo || 'comprador'}
              onChange={handleChange}
              options={TIPO_OPCOES}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="CPF"
                name="cpf"
                value={formData.cpf || ''}
                onChange={handleChange}
              />
              <Input
                label="CNPJ"
                name="cnpj"
                value={formData.cnpj || ''}
                onChange={handleChange}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Contato</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="E-mail"
                name="email"
                type="email"
                value={formData.email || ''}
                onChange={handleChange}
              />
              <Input
                label="Telefone"
                name="telefone"
                type="tel"
                value={formData.telefone || ''}
                onChange={handleChange}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Endereço</p>
            <Input
              label="Endereço"
              name="endereco"
              value={formData.endereco || ''}
              onChange={handleChange}
            />
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Input
                  label="Cidade"
                  name="cidade"
                  value={formData.cidade || ''}
                  onChange={handleChange}
                />
              </div>
              <Input
                label="UF"
                name="estado"
                value={formData.estado || ''}
                onChange={handleChange}
                maxLength={2}
              />
            </div>
          </section>

          <div className="flex justify-end gap-3 pt-6 border-t border-border-1">
            <Link href="/clientes">
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" loading={updating}>
              {updating ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      </Card>
    </AppShell>
  )
}
