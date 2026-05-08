'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Truck,
  Warehouse,
  User,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Calendar,
  Package,
} from 'lucide-react'
import {
  Card,
  Button,
  Chip,
  Tabs,
  DenseTable,
  EmptyState,
  GrainBadge,
  type DenseTableColumn,
  type GrainVariant,
} from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'
import { formatDate, formatNumber } from '@/lib/utils/formatters'

type Status = 'agendada' | 'em_transito' | 'entregue' | 'cancelada'

interface Ordem {
  id: string
  numero: string
  grao: 'soja' | 'milho' | 'trigo' | 'sorgo'
  quantidadeSc: number
  pesoToneladas?: number | null
  status: Status
  dataAgendada: string
  dataCarregamento?: string | null
  dataDescarga?: string | null
  motorista?: { id: string; nome: string; placa?: string | null } | null
  transportadora?: { id: string; razaoSocial: string } | null
  armazemOrigem?: { id: string; nome: string; cidade?: string | null; uf?: string | null } | null
  armazemDestino?: { id: string; nome: string; cidade?: string | null; uf?: string | null } | null
  contrato?: { id: string; numero: string } | null
  cliente?: { id: string; nome: string } | null
}

interface Armazem {
  id: string
  nome: string
  tipo: 'silo' | 'granel' | 'horizontal' | 'misto'
  capacidadeSc: number
  cidade?: string | null
  uf?: string | null
  proprio: boolean
  ativo: boolean
  fornecedor?: { id: string; razaoSocial: string } | null
}

interface Motorista {
  id: string
  nome: string
  cpf?: string | null
  placa?: string | null
  veiculo?: string | null
  capacidadeSc?: number | null
  ativo: boolean
  transportadora?: { id: string; razaoSocial: string } | null
}

const TABS = [
  { value: 'cargas', label: 'Cargas' },
  { value: 'armazens', label: 'Armazéns' },
  { value: 'motoristas', label: 'Motoristas' },
]

const STATUS_LABEL: Record<Status, string> = {
  agendada: 'Agendada',
  em_transito: 'Em trânsito',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
}

export function LogisticaContent() {
  const [tab, setTab] = useState<'cargas' | 'armazens' | 'motoristas'>('cargas')

  return (
    <div className="space-y-6">
      <Tabs
        options={TABS}
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />
      {tab === 'cargas' && <CargasKanban />}
      {tab === 'armazens' && <ArmazensTable />}
      {tab === 'motoristas' && <MotoristasTable />}
    </div>
  )
}

// ─── KANBAN DE CARGAS ────────────────────────────────────────────────────────

function CargasKanban() {
  const [ordens, setOrdens] = useState<Ordem[]>([])
  const [loading, setLoading] = useState(true)
  const { error: showError } = useToast()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const r = await fetch('/api/logistica/ordens?limit=200')
        if (!r.ok) throw new Error('Falha ao buscar')
        const json = await r.json()
        if (!cancelled) setOrdens(json.data || [])
      } catch (e) {
        if (!cancelled) showError('Erro ao carregar ordens')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showError])

  const buckets = useMemo(() => {
    const trintaDiasAtras = Date.now() - 30 * 24 * 60 * 60 * 1000
    const out: Record<Status, Ordem[]> = {
      agendada: [],
      em_transito: [],
      entregue: [],
      cancelada: [],
    }
    for (const o of ordens) {
      if (o.status === 'entregue') {
        const t = o.dataDescarga ? new Date(o.dataDescarga).getTime() : 0
        if (t >= trintaDiasAtras) out.entregue.push(o)
      } else {
        out[o.status]?.push(o)
      }
    }
    return out
  }, [ordens])

  if (loading) {
    return <Card className="text-center py-10 text-fg-3 text-small">Carregando…</Card>
  }

  if (ordens.length === 0) {
    return (
      <EmptyState
        icon={Truck}
        title="Nenhuma ordem de carga"
        description="Comece criando sua primeira ordem de carga vinculada a um contrato."
        cta={
          <Link href="/logistica/ordens/novo">
            <Button leftIcon={<Plus className="h-4 w-4" />}>Nova ordem</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <KanbanColumn
        title="Agendadas"
        accent="info"
        ordens={buckets.agendada}
      />
      <KanbanColumn
        title="Em trânsito"
        accent="warn"
        ordens={buckets.em_transito}
      />
      <KanbanColumn
        title="Entregues (30d)"
        accent="pos"
        ordens={buckets.entregue}
      />
      <KanbanColumn
        title="Canceladas"
        accent="neg"
        ordens={buckets.cancelada}
        collapsible
      />
    </div>
  )
}

function KanbanColumn({
  title,
  accent,
  ordens,
  collapsible,
}: {
  title: string
  accent: 'info' | 'warn' | 'pos' | 'neg'
  ordens: Ordem[]
  collapsible?: boolean
}) {
  const [collapsed, setCollapsed] = useState(!!collapsible)
  const totalSc = ordens.reduce((acc, o) => acc + (o.quantidadeSc || 0), 0)

  return (
    <Card className="space-y-3">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => collapsible && setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Chip variant={accent}>{title}</Chip>
          <span className="text-fg-3 text-small t-num">
            {ordens.length} · {formatNumber(totalSc)} sc
          </span>
        </div>
        {collapsible && (
          <span className="text-fg-3 text-small">{collapsed ? '+' : '−'}</span>
        )}
      </div>
      {!collapsed && (
        <div className="space-y-2">
          {ordens.length === 0 && (
            <p className="text-fg-3 text-small italic">Nenhuma ordem.</p>
          )}
          {ordens.map((o) => (
            <OrdemCard key={o.id} ordem={o} />
          ))}
        </div>
      )}
    </Card>
  )
}

function OrdemCard({ ordem }: { ordem: Ordem }) {
  const grain = (ordem.grao === 'sorgo' ? 'sorgo' : ordem.grao) as GrainVariant
  return (
    <Link
      href={`/logistica/ordens/${ordem.id}`}
      className="block p-3 rounded-lg border border-border-1 hover:border-accent transition-colors"
      style={{ background: 'var(--bg-2)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-fg-1 font-medium text-small t-num">{ordem.numero}</span>
        <GrainBadge variant={grain} />
      </div>
      <div className="flex items-center gap-1.5 text-fg-2 text-small mb-1">
        <Package className="h-3 w-3" />
        <span className="t-num">{formatNumber(ordem.quantidadeSc)} sc</span>
        {ordem.pesoToneladas && (
          <span className="text-fg-3 t-num">· {Number(ordem.pesoToneladas).toFixed(1)} t</span>
        )}
      </div>
      {ordem.motorista && (
        <div className="flex items-center gap-1.5 text-fg-3 text-small mb-1">
          <User className="h-3 w-3" />
          <span className="truncate">{ordem.motorista.nome}</span>
          {ordem.motorista.placa && <span className="t-num">· {ordem.motorista.placa}</span>}
        </div>
      )}
      {ordem.transportadora && (
        <div className="flex items-center gap-1.5 text-fg-3 text-small mb-1">
          <Truck className="h-3 w-3" />
          <span className="truncate">{ordem.transportadora.razaoSocial}</span>
        </div>
      )}
      {(ordem.armazemOrigem || ordem.armazemDestino) && (
        <div className="flex items-center gap-1.5 text-fg-3 text-small mb-1">
          <MapPin className="h-3 w-3" />
          <span className="truncate">
            {ordem.armazemOrigem?.nome ?? '—'} → {ordem.armazemDestino?.nome ?? '—'}
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5 text-fg-3 text-small mt-2 pt-2 border-t border-border-1">
        <Calendar className="h-3 w-3" />
        <span className="t-num">{formatDate(ordem.dataAgendada)}</span>
      </div>
    </Link>
  )
}

// ─── ARMAZÉNS TABLE ──────────────────────────────────────────────────────────

function ArmazensTable() {
  const [items, setItems] = useState<Armazem[]>([])
  const [loading, setLoading] = useState(true)
  const { success, error: showError } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/logistica/armazens?limit=100')
      if (!r.ok) throw new Error('falha')
      const json = await r.json()
      setItems(json.data || [])
    } catch (e) {
      showError('Erro ao carregar armazéns')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Deletar armazém "${nome}"?`)) return
    try {
      const r = await fetch(`/api/logistica/armazens/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      setItems((it) => it.filter((x) => x.id !== id))
      success('Armazém removido')
    } catch {
      showError('Erro ao remover')
    }
  }

  const cols: DenseTableColumn<Armazem>[] = [
    { key: 'nome', header: 'Nome', accessor: (a) => <span className="text-fg-1 font-medium">{a.nome}</span> },
    {
      key: 'tipo',
      header: 'Tipo',
      accessor: (a) => <Chip variant="info">{a.tipo}</Chip>,
    },
    {
      key: 'cap',
      header: 'Capacidade (sc)',
      isNumeric: true,
      accessor: (a) => <span className="t-num text-fg-2">{formatNumber(a.capacidadeSc)}</span>,
    },
    {
      key: 'local',
      header: 'Cidade/UF',
      accessor: (a) => (
        <span className="text-fg-2">
          {a.cidade ? `${a.cidade}/${a.uf ?? ''}` : '—'}
        </span>
      ),
    },
    {
      key: 'tipo2',
      header: 'Próprio',
      accessor: (a) => (
        <Chip variant={a.proprio ? 'pos' : 'neutral'}>
          {a.proprio ? 'Próprio' : a.fornecedor?.razaoSocial ?? 'Terceirizado'}
        </Chip>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (a) => <Chip variant={a.ativo ? 'pos' : 'neutral'}>{a.ativo ? 'Ativo' : 'Inativo'}</Chip>,
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      accessor: (a) => (
        <div className="flex gap-2 justify-end">
          <Link href={`/logistica/armazens/${a.id}/editar`}>
            <Button variant="ghost" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />}>
              Editar
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(a.id, a.nome)}
            className="text-neg hover:text-neg"
            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
          >
            Deletar
          </Button>
        </div>
      ),
    },
  ]

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Armazéns · {items.length} cadastrados</p>
        <Link href="/logistica/armazens/novo">
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
            Novo armazém
          </Button>
        </Link>
      </div>
      {loading ? (
        <p className="text-fg-3 text-small text-center py-8">Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="Nenhum armazém"
          description="Cadastre armazéns próprios ou terceirizados."
          cta={
            <Link href="/logistica/armazens/novo">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Novo armazém</Button>
            </Link>
          }
        />
      ) : (
        <DenseTable columns={cols} rows={items} rowKey={(a) => a.id} />
      )}
    </Card>
  )
}

// ─── MOTORISTAS TABLE ────────────────────────────────────────────────────────

function MotoristasTable() {
  const [items, setItems] = useState<Motorista[]>([])
  const [loading, setLoading] = useState(true)
  const { success, error: showError } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/logistica/motoristas?limit=100')
      if (!r.ok) throw new Error()
      const json = await r.json()
      setItems(json.data || [])
    } catch {
      showError('Erro ao carregar motoristas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Deletar motorista "${nome}"?`)) return
    try {
      const r = await fetch(`/api/logistica/motoristas/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      setItems((it) => it.filter((x) => x.id !== id))
      success('Motorista removido')
    } catch {
      showError('Erro ao remover')
    }
  }

  const cols: DenseTableColumn<Motorista>[] = [
    { key: 'nome', header: 'Nome', accessor: (m) => <span className="text-fg-1 font-medium">{m.nome}</span> },
    { key: 'cpf', header: 'CPF', accessor: (m) => <span className="text-fg-2 t-num">{m.cpf || '—'}</span> },
    { key: 'placa', header: 'Placa', accessor: (m) => <span className="text-fg-2 t-num">{m.placa || '—'}</span> },
    { key: 'veiculo', header: 'Veículo', accessor: (m) => <span className="text-fg-2">{m.veiculo || '—'}</span> },
    {
      key: 'cap',
      header: 'Capacidade (sc)',
      isNumeric: true,
      accessor: (m) => <span className="t-num text-fg-2">{m.capacidadeSc ? formatNumber(m.capacidadeSc) : '—'}</span>,
    },
    {
      key: 'transp',
      header: 'Transportadora',
      accessor: (m) => <span className="text-fg-2">{m.transportadora?.razaoSocial ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (m) => <Chip variant={m.ativo ? 'pos' : 'neutral'}>{m.ativo ? 'Ativo' : 'Inativo'}</Chip>,
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      accessor: (m) => (
        <div className="flex gap-2 justify-end">
          <Link href={`/logistica/motoristas/${m.id}/editar`}>
            <Button variant="ghost" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />}>
              Editar
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(m.id, m.nome)}
            className="text-neg hover:text-neg"
            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
          >
            Deletar
          </Button>
        </div>
      ),
    },
  ]

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Motoristas · {items.length} cadastrados</p>
        <Link href="/logistica/motoristas/novo">
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
            Novo motorista
          </Button>
        </Link>
      </div>
      {loading ? (
        <p className="text-fg-3 text-small text-center py-8">Carregando…</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={User}
          title="Nenhum motorista"
          description="Cadastre motoristas vinculados às transportadoras."
          cta={
            <Link href="/logistica/motoristas/novo">
              <Button leftIcon={<Plus className="h-4 w-4" />}>Novo motorista</Button>
            </Link>
          }
        />
      ) : (
        <DenseTable columns={cols} rows={items} rowKey={(m) => m.id} />
      )}
    </Card>
  )
}

export { STATUS_LABEL }
