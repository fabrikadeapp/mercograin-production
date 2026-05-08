'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Pencil,
  Truck,
  MapPin,
  Calendar,
  Package,
  CheckCircle2,
  Circle,
  User,
  FileText,
} from 'lucide-react'
import {
  AppShell,
  PageHeader,
  Card,
  Button,
  Chip,
  GrainBadge,
  type GrainVariant,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { formatDate, formatNumber } from '@/lib/utils/formatters'

type Status = 'agendada' | 'em_transito' | 'entregue' | 'cancelada'

const STATUS_LABEL: Record<Status, string> = {
  agendada: 'Agendada',
  em_transito: 'Em trânsito',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
}
const STATUS_VARIANT: Record<Status, 'info' | 'warn' | 'pos' | 'neg'> = {
  agendada: 'info',
  em_transito: 'warn',
  entregue: 'pos',
  cancelada: 'neg',
}

const PROXIMO: Record<Status, Status | null> = {
  agendada: 'em_transito',
  em_transito: 'entregue',
  entregue: null,
  cancelada: null,
}

export default function OrdemDetalhePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { success, error: showError } = useToast()
  const [loading, setLoading] = useState(true)
  const [ordem, setOrdem] = useState<any>(null)
  const [updating, setUpdating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/logistica/ordens/${params.id}`)
      if (!r.ok) throw new Error()
      const j = await r.json()
      setOrdem(j)
    } catch {
      showError('Erro ao carregar ordem')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [params.id])

  const avancarStatus = async () => {
    if (!ordem) return
    const proximo = PROXIMO[ordem.status as Status]
    if (!proximo) return
    setUpdating(true)
    try {
      const r = await fetch(`/api/logistica/ordens/${params.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: proximo }),
      })
      if (!r.ok) throw new Error()
      success(`Status atualizado: ${STATUS_LABEL[proximo]}`)
      await load()
    } catch {
      showError('Erro ao atualizar status')
    } finally {
      setUpdating(false)
    }
  }

  const cancelar = async () => {
    if (!confirm('Cancelar esta ordem?')) return
    setUpdating(true)
    try {
      const r = await fetch(`/api/logistica/ordens/${params.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelada' }),
      })
      if (!r.ok) throw new Error()
      success('Ordem cancelada')
      await load()
    } catch {
      showError('Erro ao cancelar')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Card className="text-center py-16 text-fg-3">Carregando…</Card>
      </AppShell>
    )
  }
  if (!ordem) return null

  const status = ordem.status as Status
  const grain = (ordem.grao === 'sorgo' ? 'sorgo' : ordem.grao) as GrainVariant
  const proximo = PROXIMO[status]

  return (
    <AppShell>
      <PageHeader
        eyebrow={`Logística · ${ordem.numero}`}
        title="Detalhe da ordem"
        subtitle={`${formatNumber(ordem.quantidadeSc)} sc de ${ordem.grao} · ${STATUS_LABEL[status]}`}
        actions={
          <div className="flex gap-2">
            <Link href="/logistica">
              <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />}>Voltar</Button>
            </Link>
            <Link href={`/logistica/ordens/${ordem.id}/editar`}>
              <Button variant="secondary" leftIcon={<Pencil className="h-4 w-4" />}>
                Editar
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Timeline</p>
            <Chip variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Chip>
          </div>
          <Timeline ordem={ordem} />

          {status !== 'cancelada' && status !== 'entregue' && (
            <div className="flex justify-end gap-2 pt-4 border-t border-border-1">
              <Button variant="ghost" onClick={cancelar} loading={updating}>
                Cancelar ordem
              </Button>
              {proximo && (
                <Button onClick={avancarStatus} loading={updating}>
                  Avançar para {STATUS_LABEL[proximo]}
                </Button>
              )}
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <p className="eyebrow">Resumo</p>
          <div className="space-y-3 text-small">
            <Row icon={<FileText className="h-4 w-4" />} label="Número" value={<span className="t-num">{ordem.numero}</span>} />
            <Row icon={<Package className="h-4 w-4" />} label="Grão" value={<GrainBadge variant={grain} />} />
            <Row
              label="Quantidade"
              value={<span className="t-num">{formatNumber(ordem.quantidadeSc)} sc</span>}
            />
            {ordem.pesoToneladas && (
              <Row
                label="Peso"
                value={<span className="t-num">{Number(ordem.pesoToneladas).toFixed(2)} t</span>}
              />
            )}
            {ordem.contrato && (
              <Row label="Contrato" value={<span className="t-num text-fg-2">{ordem.contrato.numero}</span>} />
            )}
            {ordem.cliente && <Row label="Cliente" value={<span className="text-fg-2">{ordem.cliente.nome}</span>} />}
          </div>
        </Card>

        <Card className="space-y-3">
          <p className="eyebrow flex items-center gap-2">
            <Truck className="h-4 w-4" /> Transporte
          </p>
          {ordem.transportadora ? (
            <p className="text-fg-2 text-small">{ordem.transportadora.razaoSocial}</p>
          ) : (
            <p className="text-fg-3 text-small italic">Não atribuída</p>
          )}
          {ordem.motorista ? (
            <div className="text-small space-y-1">
              <p className="text-fg-1 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {ordem.motorista.nome}
              </p>
              {ordem.motorista.placa && (
                <p className="text-fg-3 t-num">Placa: {ordem.motorista.placa}</p>
              )}
              {ordem.motorista.veiculo && <p className="text-fg-3">{ordem.motorista.veiculo}</p>}
              {ordem.motorista.telefone && (
                <p className="text-fg-3 t-num">Tel: {ordem.motorista.telefone}</p>
              )}
            </div>
          ) : (
            <p className="text-fg-3 text-small italic">Motorista não atribuído</p>
          )}
        </Card>

        <Card className="space-y-3">
          <p className="eyebrow flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Origem → Destino
          </p>
          <div className="space-y-2 text-small">
            <div>
              <p className="text-fg-3">Origem</p>
              <p className="text-fg-1">
                {ordem.armazemOrigem
                  ? `${ordem.armazemOrigem.nome}${ordem.armazemOrigem.cidade ? ` · ${ordem.armazemOrigem.cidade}/${ordem.armazemOrigem.uf ?? ''}` : ''}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-fg-3">Destino</p>
              <p className="text-fg-1">
                {ordem.armazemDestino
                  ? `${ordem.armazemDestino.nome}${ordem.armazemDestino.cidade ? ` · ${ordem.armazemDestino.cidade}/${ordem.armazemDestino.uf ?? ''}` : ''}`
                  : '—'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <p className="eyebrow flex items-center gap-2">
            <FileText className="h-4 w-4" /> CT-e
          </p>
          {ordem.ctEnumero ? (
            <div className="space-y-1 text-small">
              <p className="text-fg-1 t-num">{ordem.ctEnumero}</p>
              {ordem.ctEdataEmissao && (
                <p className="text-fg-3">Emitido em {formatDate(ordem.ctEdataEmissao)}</p>
              )}
              {ordem.ctEpdfUrl && (
                <a
                  href={ordem.ctEpdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent text-small underline"
                >
                  Abrir PDF
                </a>
              )}
            </div>
          ) : (
            <p className="text-fg-3 text-small italic">CT-e não emitido</p>
          )}
          {ordem.observacao && (
            <div className="pt-3 border-t border-border-1">
              <p className="eyebrow mb-1">Observação</p>
              <p className="text-fg-2 text-small">{ordem.observacao}</p>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-3 flex items-center gap-1.5">
        {icon} {label}
      </span>
      <span>{value}</span>
    </div>
  )
}

function Timeline({ ordem }: { ordem: any }) {
  const steps = [
    {
      label: 'Agendada',
      date: ordem.dataAgendada,
      done: !!ordem.dataAgendada,
    },
    {
      label: 'Carregada',
      date: ordem.dataCarregamento,
      done: !!ordem.dataCarregamento,
    },
    {
      label: 'Em trânsito',
      date: ordem.dataCarregamento,
      done: ordem.status === 'em_transito' || ordem.status === 'entregue',
    },
    {
      label: 'Entregue',
      date: ordem.dataDescarga,
      done: !!ordem.dataDescarga,
    },
  ]

  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={i} className="flex items-start gap-3">
          {s.done ? (
            <CheckCircle2 className="h-5 w-5 text-pos shrink-0 mt-0.5" />
          ) : (
            <Circle className="h-5 w-5 text-fg-3 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={s.done ? 'text-fg-1 font-medium' : 'text-fg-3'}>{s.label}</p>
            {s.date && (
              <p className="text-fg-3 text-small flex items-center gap-1.5 mt-0.5">
                <Calendar className="h-3 w-3" />
                <span className="t-num">{formatDate(s.date)}</span>
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
