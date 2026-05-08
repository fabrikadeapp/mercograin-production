'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Plus, Trash2, Wheat, Loader2 } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency } from '@/lib/utils/formatters'

interface Cliente {
  id: string
  nome: string
}

interface GraoItem {
  grao: string
  quantidade: number
  preco: number
  subtotal: number
}

const propostaSchema = z.object({
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  numero: z.string().min(1, 'Número é obrigatório'),
  tipo: z.enum(['venda', 'compra'], { errorMap: () => ({ message: 'Tipo inválido' }) }),
  descricao: z.string().optional(),
  validadeEm: z.string().min(1, 'Data de validade é obrigatória'),
})

type PropostaFormData = z.infer<typeof propostaSchema>

const GRAOS_DISPONIVEIS = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
  { value: 'algodao', label: 'Algodão' },
  { value: 'cafe', label: 'Café' },
  { value: 'arroz', label: 'Arroz' },
]

const TIPO_OPCOES = [
  { value: 'venda', label: 'Venda' },
  { value: 'compra', label: 'Compra' },
]

export default function NovaPropostaPage() {
  const router = useRouter()
  const { success, error: showError } = useToast()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [graos, setGraos] = useState<GraoItem[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PropostaFormData>({
    resolver: zodResolver(propostaSchema),
    defaultValues: { tipo: 'venda' },
  })

  useEffect(() => {
    fetchClientes()
  }, [])

  const fetchClientes = async () => {
    try {
      const response = await fetch('/api/clientes?limit=200')
      if (!response.ok) throw new Error('Erro ao buscar clientes')
      const json = await response.json()
      // API retorna { data: [...], pagination } ou array direto (compat)
      const list = Array.isArray(json) ? json : (json.data ?? [])
      setClientes(list)
    } catch (err) {
      showError('Erro ao carregar clientes')
      console.error(err)
    } finally {
      setLoadingClientes(false)
    }
  }

  const handleAddGrao = () => {
    setGraos((prev) => [...prev, { grao: 'soja', quantidade: 0, preco: 0, subtotal: 0 }])
  }

  const handleRemoveGrao = (index: number) => {
    setGraos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleGraoChange = (
    index: number,
    field: keyof GraoItem,
    value: string | number
  ) => {
    setGraos((prev) => {
      const updated = [...prev]
      const grao = updated[index]

      if (field === 'quantidade' || field === 'preco') {
        const quantidade = field === 'quantidade' ? (value as number) : grao.quantidade
        const preco = field === 'preco' ? (value as number) : grao.preco
        grao[field] = value as never
        grao.subtotal = Math.round(quantidade * preco * 100) / 100
      } else {
        grao[field] = value as never
      }

      return updated
    })
  }

  const valorTotal = graos.reduce((acc, g) => acc + g.subtotal, 0)

  const onSubmit = async (data: PropostaFormData) => {
    if (graos.length === 0) {
      showError('Adicione pelo menos um grão')
      return
    }

    setSaving(true)

    try {
      const payload = { ...data, graos, valor: valorTotal }

      const response = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const res = await response.json()
        throw new Error(res.error || 'Erro ao criar proposta')
      }

      success('Proposta criada com sucesso!')
      router.push('/propostas')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar proposta')
    } finally {
      setSaving(false)
    }
  }

  if (loadingClientes) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-fg-3 text-small gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      </AppShell>
    )
  }

  const clienteOptions = [
    { value: '', label: 'Selecione um cliente' },
    ...clientes.map((c) => ({ value: c.id, label: c.nome })),
  ]

  return (
    <AppShell>
      <PageHeader
        eyebrow="Comercial · Nova proposta"
        title="Nova proposta"
        subtitle="Crie uma proposta comercial com especificação de grãos e validade."
        search={false}
        actions={
          <Link href="/propostas">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />

      {clientes.length === 0 ? (
        <Card className="text-center py-16 space-y-3">
          <p className="eyebrow">Pré-requisito</p>
          <h3 className="text-h3 font-sans tracking-tight text-fg-1">
            Cadastre um cliente primeiro
          </h3>
          <p className="text-fg-2 text-body">
            Você precisa de pelo menos um cliente para criar uma proposta.
          </p>
          <div className="pt-2">
            <Link href="/clientes/novo">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Criar cliente</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card className="space-y-6">
            <section className="space-y-4">
              <p className="eyebrow">Dados da proposta</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Cliente *"
                  options={clienteOptions}
                  {...register('clienteId')}
                  error={errors.clienteId?.message}
                />
                <Input
                  label="Número da proposta *"
                  placeholder="EX: PROP-2024-001"
                  {...register('numero')}
                  error={errors.numero?.message}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Tipo *"
                  options={TIPO_OPCOES}
                  {...register('tipo')}
                  error={errors.tipo?.message}
                />
                <Input
                  label="Válida até *"
                  type="date"
                  {...register('validadeEm')}
                  error={errors.validadeEm?.message}
                />
              </div>
              <div className="space-y-1.5">
                <label className="eyebrow">Descrição · Observações</label>
                <textarea
                  {...register('descricao')}
                  rows={3}
                  placeholder="Detalhes adicionais da proposta"
                  className="w-full px-4 py-3 rounded-md bg-bg-2 border border-border-1 hover:border-border-2 focus:outline-none focus:ring-2 focus:ring-accent text-fg-1 text-body placeholder:text-fg-3 resize-y"
                />
              </div>
            </section>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wheat className="h-4 w-4 text-accent" />
                <h3 className="text-fg-1 font-semibold">Especificação de grãos</h3>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={handleAddGrao}
              >
                Adicionar grão
              </Button>
            </div>

            {graos.length === 0 ? (
              <div className="rounded-md bg-bg-2 border border-border-1 border-dashed p-6 text-center text-fg-3 text-small">
                Adicione pelo menos um grão para esta proposta.
              </div>
            ) : (
              <div className="space-y-3">
                {graos.map((grao, index) => (
                  <div
                    key={index}
                    className="rounded-md bg-bg-2 border border-border-1 p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Select
                        label="Grão"
                        options={GRAOS_DISPONIVEIS}
                        value={grao.grao}
                        onChange={(e) => handleGraoChange(index, 'grao', e.target.value)}
                      />
                      <Input
                        label="Quantidade (t)"
                        type="number"
                        step="0.1"
                        value={grao.quantidade || ''}
                        onChange={(e) =>
                          handleGraoChange(index, 'quantidade', parseFloat(e.target.value) || 0)
                        }
                      />
                      <Input
                        label="Preço (R$/t)"
                        type="number"
                        step="0.01"
                        value={grao.preco || ''}
                        onChange={(e) =>
                          handleGraoChange(index, 'preco', parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border-1">
                      <div>
                        <p className="eyebrow">Subtotal</p>
                        <p className="t-num text-fg-1 font-semibold">
                          {formatCurrency(grao.subtotal)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => handleRemoveGrao(index)}
                        className="text-neg hover:text-neg"
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Valor total</p>
                <p className="text-fg-3 text-small">Soma dos subtotais</p>
              </div>
              <p className="t-num-lg text-accent">{formatCurrency(valorTotal)}</p>
            </div>
          </Card>

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/propostas">
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" loading={saving}>
              {saving ? 'Criando…' : 'Criar proposta'}
            </Button>
          </div>
        </form>
      )}
    </AppShell>
  )
}
