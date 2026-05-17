'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  DenseTable,
  GrainBadge,
  type DenseTableColumn,
  type GrainVariant,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { formatDate } from '@/lib/utils/formatters'

const contratoFormSchema = z.object({
  dataInicio: z.string().min(1, 'Data de início obrigatória'),
  dataFim: z.string().optional(),
  statusAssinatura: z.enum(['pendente', 'assinado', 'cancelado']),
})

type ContratoFormData = z.infer<typeof contratoFormSchema>

interface GraoItem {
  grao: string
  quantidade: number
  preco: number
  subtotal: number
}

interface Contrato {
  id: string
  numero: string
  dataInicio: string
  dataFim?: string
  statusAssinatura: 'pendente' | 'assinado' | 'cancelado'
  criadoEm: string
  cliente: {
    id: string
    nome: string
  }
  proposta: {
    numero: string
    graos: GraoItem[]
    valorTotal: number
    tipo: 'venda' | 'compra'
  }
}

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'assinado', label: 'Assinado' },
  { value: 'cancelado', label: 'Cancelado' },
]

const KNOWN_GRAINS: GrainVariant[] = ['soja', 'milho', 'trigo', 'sorgo', 'usd']

function toGrainVariant(value: string): GrainVariant {
  const normalized = value.toLowerCase() as GrainVariant
  return KNOWN_GRAINS.includes(normalized) ? normalized : 'soja'
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export default function EditarContratoPage() {
  const { id } = useParams()
  const router = useRouter()
  const { status } = useSession()
  const { success, error: showError } = useToast()

  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
    reset,
  } = useForm<ContratoFormData>({
    resolver: zodResolver(contratoFormSchema),
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      fetchContrato()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router])

  const fetchContrato = async () => {
    try {
      const response = await fetch(`/api/contratos/${id}`)
      if (!response.ok) {
        throw new Error('Contrato não encontrado')
      }
      const data: Contrato = await response.json()
      setContrato(data)

      const dataInicioISO = data.dataInicio ? data.dataInicio.split('T')[0] : ''
      const dataFimISO = data.dataFim ? data.dataFim.split('T')[0] : ''

      reset({
        dataInicio: dataInicioISO,
        dataFim: dataFimISO,
        statusAssinatura: data.statusAssinatura,
      })
    } catch (err) {
      showError('Erro ao carregar contrato')
      console.error(err)
      router.push('/contratos')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: ContratoFormData) => {
    if (!contrato) return

    setSubmitting(true)
    try {
      const payload = {
        dataInicio: data.dataInicio,
        dataFim: data.dataFim || null,
        statusAssinatura: data.statusAssinatura,
      }

      const response = await fetch(`/api/contratos/${contrato.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar contrato')
      }

      const updated = await response.json()
      setContrato(updated)
      success('Contrato atualizado com sucesso!')
      router.push(`/contratos/${contrato.id}`)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao atualizar contrato')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <Card className="px-8 py-10 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <span className="text-fg-2 text-small">Carregando contrato…</span>
          </Card>
        </div>
      </AppShell>
    )
  }

  if (!contrato) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <Card className="max-w-md w-full text-center space-y-4">
            <p className="text-fg-2">Contrato não encontrado</p>
            <Link href="/contratos">
              <Button variant="primary" fullWidth>
                Voltar para Contratos
              </Button>
            </Link>
          </Card>
        </div>
      </AppShell>
    )
  }

  const graoColumns: DenseTableColumn<GraoItem>[] = [
    {
      key: 'grao',
      header: 'Grão',
      accessor: (row) => <GrainBadge variant={toGrainVariant(row.grao)} label={row.grao} />,
    },
    {
      key: 'quantidade',
      header: 'Qtd (t)',
      align: 'right',
      isNumeric: true,
      accessor: (row) => row.quantidade,
    },
    {
      key: 'preco',
      header: 'Preço (R$/t)',
      align: 'right',
      isNumeric: true,
      accessor: (row) => currencyFormatter.format(row.preco),
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      align: 'right',
      isNumeric: true,
      accessor: (row) => (
        <span className="text-fg-1 font-medium">{currencyFormatter.format(row.subtotal)}</span>
      ),
    },
  ]

  return (
    <AppShell>
      <PageHeader
        eyebrow={`#CTR-${contrato.numero}`}
        title="Editar contrato"
        subtitle={contrato.cliente.nome}
        search={false}
        showBell={false}
        actions={
          <Link href={`/contratos/${contrato.id}`}>
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">
        <Card className="space-y-5">
          <div className="space-y-1">
            <p className="eyebrow">Informações</p>
            <h3 className="text-h3 font-sans tracking-tight text-fg-1">
              Dados de origem
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1">
              <p className="eyebrow">Cliente</p>
              <p className="text-fg-1 font-medium">{contrato.cliente.nome}</p>
            </div>
            <div className="space-y-1">
              <p className="eyebrow">Proposta</p>
              <p className="text-fg-1 font-medium font-mono tabular-nums">
                {contrato.proposta.numero}
              </p>
            </div>
            <div className="space-y-1">
              <p className="eyebrow">Criado em</p>
              <p className="text-fg-1 font-medium font-mono tabular-nums">
                {formatDate(contrato.criadoEm)}
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <p className="eyebrow">Especificação de grãos</p>
          <DenseTable
            columns={graoColumns}
            rows={contrato.proposta.graos}
            rowKey={(row) => `${row.grao}-${row.quantidade}-${row.preco}`}
          />
        </div>

        <Card className="space-y-5">
          <div className="space-y-1">
            <p className="eyebrow">Datas e status</p>
            <h3 className="text-h3 font-sans tracking-tight text-fg-1">
              Detalhes editáveis
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Controller
              control={control}
              name="dataInicio"
              render={({ field }) => (
                <Input
                  {...field}
                  type="date"
                  label="Data de início"
                  error={errors.dataInicio?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="dataFim"
              render={({ field }) => (
                <Input
                  {...field}
                  value={field.value ?? ''}
                  type="date"
                  label="Data de término (opcional)"
                  error={errors.dataFim?.message}
                />
              )}
            />
          </div>

          <Select
            label="Status de assinatura"
            options={STATUS_OPTIONS}
            error={errors.statusAssinatura?.message}
            {...register('statusAssinatura')}
          />
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Link href={`/contratos/${contrato.id}`}>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" variant="primary" loading={submitting}>
            Salvar
          </Button>
        </div>
      </form>
    </AppShell>
  )
}
