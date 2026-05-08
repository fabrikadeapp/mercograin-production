'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Input,
  Select,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

const schema = z.object({
  contratoId: z.string().optional(),
  clienteId: z.string().optional(),
  motoristaId: z.string().optional(),
  transportadoraId: z.string().optional(),
  armazemOrigemId: z.string().optional(),
  armazemDestinoId: z.string().optional(),
  grao: z.enum(['soja', 'milho', 'trigo', 'sorgo']),
  quantidadeSc: z.coerce.number().int().positive('Quantidade obrigatória'),
  pesoToneladas: z.string().optional(),
  dataAgendada: z.string().min(1, 'Data obrigatória'),
  dataCarregamento: z.string().optional(),
  dataDescarga: z.string().optional(),
  ctEnumero: z.string().optional(),
  ctEdataEmissao: z.string().optional(),
  ctEpdfUrl: z.string().optional(),
  status: z.enum(['agendada', 'em_transito', 'entregue', 'cancelada']),
  observacao: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const GRAO_OPTS = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'trigo', label: 'Trigo' },
  { value: 'sorgo', label: 'Sorgo' },
]
const STATUS_OPTS = [
  { value: 'agendada', label: 'Agendada' },
  { value: 'em_transito', label: 'Em trânsito' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelada', label: 'Cancelada' },
]

export default function NovaOrdemPage() {
  const router = useRouter()
  const { success, error: showError } = useToast()
  const [contratos, setContratos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [motoristas, setMotoristas] = useState<any[]>([])
  const [transportadoras, setTransp] = useState<any[]>([])
  const [armazens, setArmazens] = useState<any[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { grao: 'soja', status: 'agendada' },
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/contratos?limit=200').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/clientes?limit=200').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/logistica/motoristas?ativo=true&limit=200').then((r) => r.json()),
      fetch('/api/fornecedores?tipo=transportadora&ativo=true&limit=200').then((r) => r.json()),
      fetch('/api/logistica/armazens?ativo=true&limit=200').then((r) => r.json()),
    ]).then(([c, cli, m, t, a]) => {
      setContratos(c.data || c.contratos || [])
      setClientes(cli.data || [])
      setMotoristas(m.data || [])
      setTransp(t.data || [])
      setArmazens(a.data || [])
    })
  }, [])

  const onSubmit = async (data: FormData) => {
    try {
      const payload: any = {
        ...data,
        contratoId: data.contratoId || null,
        clienteId: data.clienteId || null,
        motoristaId: data.motoristaId || null,
        transportadoraId: data.transportadoraId || null,
        armazemOrigemId: data.armazemOrigemId || null,
        armazemDestinoId: data.armazemDestinoId || null,
        pesoToneladas: data.pesoToneladas ? Number(data.pesoToneladas) : null,
        dataCarregamento: data.dataCarregamento || null,
        dataDescarga: data.dataDescarga || null,
        ctEdataEmissao: data.ctEdataEmissao || null,
      }
      const r = await fetch('/api/logistica/ordens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const j = await r.json()
        throw new Error(j.error || 'Erro')
      }
      const created = await r.json()
      success(`Ordem ${created.numero} criada`)
      router.push(`/logistica/ordens/${created.id}`)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Logística · Nova ordem"
        title="Nova ordem de carga"
        subtitle="O número da OC é gerado automaticamente."
        actions={
          <Link href="/logistica">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>Voltar</Button>
          </Link>
        }
      />
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <section className="space-y-4">
            <p className="eyebrow">Contrato e contraparte</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Contrato"
                options={[
                  { value: '', label: '— Sem contrato —' },
                  ...contratos.map((c: any) => ({ value: c.id, label: c.numero })),
                ]}
                {...register('contratoId')}
              />
              <Select
                label="Cliente"
                options={[
                  { value: '', label: '— Sem cliente —' },
                  ...clientes.map((c: any) => ({ value: c.id, label: c.nome })),
                ]}
                {...register('clienteId')}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Carga</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label="Grão *" options={GRAO_OPTS} {...register('grao')} error={errors.grao?.message} />
              <Input
                label="Quantidade (sc) *"
                type="number"
                {...register('quantidadeSc')}
                error={errors.quantidadeSc?.message}
              />
              <Input
                label="Peso (toneladas)"
                type="number"
                step="0.01"
                {...register('pesoToneladas')}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Origem e destino</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Armazém de origem"
                options={[
                  { value: '', label: '— Selecione —' },
                  ...armazens.map((a: any) => ({
                    value: a.id,
                    label: `${a.nome}${a.cidade ? ` · ${a.cidade}/${a.uf ?? ''}` : ''}`,
                  })),
                ]}
                {...register('armazemOrigemId')}
              />
              <Select
                label="Armazém de destino"
                options={[
                  { value: '', label: '— Selecione —' },
                  ...armazens.map((a: any) => ({
                    value: a.id,
                    label: `${a.nome}${a.cidade ? ` · ${a.cidade}/${a.uf ?? ''}` : ''}`,
                  })),
                ]}
                {...register('armazemDestinoId')}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Transporte</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Transportadora"
                options={[
                  { value: '', label: '— Selecione —' },
                  ...transportadoras.map((t: any) => ({ value: t.id, label: t.razaoSocial })),
                ]}
                {...register('transportadoraId')}
              />
              <Select
                label="Motorista"
                options={[
                  { value: '', label: '— Selecione —' },
                  ...motoristas.map((m: any) => ({
                    value: m.id,
                    label: `${m.nome}${m.placa ? ` · ${m.placa}` : ''}`,
                  })),
                ]}
                {...register('motoristaId')}
              />
            </div>
          </section>

          <section className="space-y-4">
            <p className="eyebrow">Datas e status</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Data agendada *"
                type="date"
                {...register('dataAgendada')}
                error={errors.dataAgendada?.message}
              />
              <Input label="Data carregamento" type="date" {...register('dataCarregamento')} />
              <Input label="Data descarga" type="date" {...register('dataDescarga')} />
            </div>
            <Select label="Status" options={STATUS_OPTS} {...register('status')} />
          </section>

          <section className="space-y-4">
            <p className="eyebrow">CT-e</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="CT-e número" {...register('ctEnumero')} />
              <Input label="CT-e data emissão" type="date" {...register('ctEdataEmissao')} />
            </div>
            <Input label="CT-e PDF URL" {...register('ctEpdfUrl')} />
          </section>

          <section className="space-y-4">
            <Input label="Observação" {...register('observacao')} />
          </section>

          <div className="flex justify-end gap-3 pt-6 border-t border-border-1">
            <Link href="/logistica">
              <Button type="button" variant="ghost">Cancelar</Button>
            </Link>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Criando…' : 'Criar ordem'}
            </Button>
          </div>
        </form>
      </Card>
    </AppShell>
  )
}
