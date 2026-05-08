'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ArrowLeft, Info, Loader2 } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  DenseTable,
  type DenseTableColumn,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { formatCurrency } from '@/lib/utils/formatters'

const contratoFormSchema = z.object({
  proposIdFk: z.string().min(1, 'Selecione uma proposta'),
  dataInicio: z.string().min(1, 'Data de início obrigatória'),
  dataFim: z.string().optional(),
})

type ContratoFormData = z.infer<typeof contratoFormSchema>

interface Grao {
  grao: string
  quantidade: number
  preco: number
  subtotal: number
}

interface Proposta {
  id: string
  numero: string
  cliente: { id: string; nome: string }
  status: string
  graos: Grao[]
  valorTotal: number
}

export default function NovoContratoPage() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { success, error: showError } = useToast()

  const [propostas, setPropostas] = useState<Proposta[]>([])
  const [selectedProposta, setSelectedProposta] = useState<Proposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const proposIdFromUrl = searchParams.get('proposIdFk')

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ContratoFormData>({
    resolver: zodResolver(contratoFormSchema),
    defaultValues: {
      proposIdFk: proposIdFromUrl || '',
      dataInicio: '',
      dataFim: '',
    },
  })

  const selectedProposIdValue = watch('proposIdFk')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') fetchPropostas()
  }, [status, router])

  useEffect(() => {
    if (propostas.length > 0 && selectedProposIdValue) {
      const proposta = propostas.find((p) => p.id === selectedProposIdValue)
      setSelectedProposta(proposta || null)
    } else {
      setSelectedProposta(null)
    }
  }, [selectedProposIdValue, propostas])

  const fetchPropostas = async () => {
    try {
      const response = await fetch('/api/propostas?status=aceita&limit=100')
      if (!response.ok) throw new Error('Erro ao buscar propostas')
      const data = await response.json()
      setPropostas(data.data || [])
    } catch (err) {
      showError('Erro ao carregar propostas')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: ContratoFormData) => {
    if (!selectedProposta) {
      showError('Selecione uma proposta')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        proposIdFk: data.proposIdFk,
        clienteId: selectedProposta.cliente.id,
        numero: `CTR-${Date.now()}`,
        dataInicio: new Date(data.dataInicio),
        dataFim: data.dataFim ? new Date(data.dataFim) : null,
      }

      const response = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar contrato')
      }

      const contrato = await response.json()
      success('Contrato criado com sucesso!')
      router.push(`/contratos/${contrato.id}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao criar contrato')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-fg-3 text-small gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando propostas…
        </div>
      </AppShell>
    )
  }

  const propostaOptions = [
    { value: '', label: 'Selecione uma proposta aceita' },
    ...propostas.map((p) => ({
      value: p.id,
      label: `PROP-${p.numero} · ${p.cliente.nome}`,
    })),
  ]

  const graoColumns: DenseTableColumn<Grao>[] = [
    {
      key: 'grao',
      header: 'Grão',
      accessor: (g) => <span className="text-fg-1 capitalize">{g.grao}</span>,
    },
    {
      key: 'quantidade',
      header: 'Qtd (t)',
      align: 'right',
      isNumeric: true,
      accessor: (g) => g.quantidade.toLocaleString('pt-BR'),
    },
    {
      key: 'preco',
      header: 'Preço (R$/t)',
      align: 'right',
      isNumeric: true,
      accessor: (g) => formatCurrency(g.preco),
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      align: 'right',
      isNumeric: true,
      accessor: (g) => (
        <span className="text-fg-1 font-semibold">{formatCurrency(g.subtotal)}</span>
      ),
    },
  ]

  return (
    <AppShell>
      <PageHeader
        eyebrow="Comercial · Novo contrato"
        title="Novo contrato"
        subtitle="Formalize uma proposta aceita em um contrato comercial."
        search={false}
        actions={
          <Link href="/contratos">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />

      {propostas.length === 0 ? (
        <Card className="text-center py-16 space-y-3">
          <p className="eyebrow">Pré-requisito</p>
          <h3 className="text-h3 font-sans tracking-tight text-fg-1">
            Nenhuma proposta aceita
          </h3>
          <p className="text-fg-2 text-body">
            É necessário ter ao menos uma proposta com status &ldquo;aceita&rdquo;.
          </p>
          <div className="pt-2">
            <Link href="/propostas">
              <Button>Ver propostas</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card className="space-y-4">
            <p className="eyebrow">Proposta de origem</p>
            <Select
              label="Proposta *"
              options={propostaOptions}
              {...register('proposIdFk')}
              error={errors.proposIdFk?.message}
            />

            {selectedProposta && (
              <div className="space-y-4 pt-4 border-t border-border-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="eyebrow">Cliente</p>
                    <p className="text-fg-1 font-semibold mt-1">
                      {selectedProposta.cliente.nome}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="eyebrow">Valor total</p>
                    <p className="t-num-lg text-accent mt-1">
                      {formatCurrency(selectedProposta.valorTotal)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="eyebrow mb-2">Especificação de grãos</p>
                  <DenseTable
                    columns={graoColumns}
                    rows={selectedProposta.graos}
                    rowKey={(g) => g.grao}
                  />
                </div>
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <p className="eyebrow">Vigência</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Data de início *"
                type="date"
                {...register('dataInicio')}
                error={errors.dataInicio?.message}
              />
              <Input
                label="Data de fim (opcional)"
                type="date"
                {...register('dataFim')}
                error={errors.dataFim?.message}
              />
            </div>
            <div className="flex items-start gap-2 text-fg-3 text-small">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                As datas definem o período de vigência do contrato. A data de fim é opcional para
                contratos sem prazo definido.
              </span>
            </div>
          </Card>

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/contratos">
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" loading={submitting} disabled={!selectedProposta}>
              {submitting ? 'Criando…' : 'Criar contrato'}
            </Button>
          </div>
        </form>
      )}
    </AppShell>
  )
}
