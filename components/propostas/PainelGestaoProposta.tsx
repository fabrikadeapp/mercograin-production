'use client'

import { useEffect, useState } from 'react'
import {
  Send,
  CheckCircle2,
  XCircle,
  Calendar,
  Plus,
  Trash2,
  MessageSquare,
  Loader2,
  ChevronRight,
  AlertCircle,
  Lightbulb,
  Trophy,
  Phone,
  Eye,
  FileText,
  PenLine,
  Sparkles,
} from 'lucide-react'
import { Card, Button, Select } from '@/components/ui/phb'
import { useToast } from '@/contexts/ToastContext'

export interface PainelGestaoPropostaProps {
  propostaId: string
  /** Status inicial vindo do server. */
  statusInicial: string
  /** Quando muda algo, dispara para o pai recarregar a proposta. */
  onChange?: () => void
}

interface StatusInfo {
  atual: string
  destinosValidos: string[]
  lossReasons: string[]
}

interface Nota {
  id: string
  texto: string
  autorNome: string | null
  categoria: string | null
  criadaEm: string
}

interface Agenda {
  id: string
  titulo: string
  descricao: string | null
  agendadoPara: string
  responsavelNome: string | null
  status: 'pendente' | 'concluido' | 'cancelado'
  concluidoEm: string | null
  concluidoComentario: string | null
}

interface TimelineEvent {
  id: string
  tipo: string
  label: string
  detalhe?: string
  em: string
  autor?: string
}

interface TimelineData {
  events: TimelineEvent[]
  proximas: TimelineEvent[]
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando_autorizacao: 'Aguardando autorização',
  pendente_aprovacao: 'Pendente aprovação',
  pronta_para_enviar: 'Pronta para enviar',
  enviada: 'Enviada',
  em_negociacao: 'Em negociação',
  aceita: 'Aceita',
  aprovada: 'Aprovada',
  sucesso: 'Sucesso',
  fechado: 'Fechado',
  concluido: 'Concluído',
  faturado: 'Faturado',
  recusada: 'Recusada',
  perdida: 'Perdida',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
  expirada: 'Expirada',
}

const LOSS_REASON_LABEL: Record<string, string> = {
  preco: 'Preço',
  concorrencia: 'Concorrência',
  prazo: 'Prazo',
  qualidade: 'Qualidade',
  logistica: 'Logística',
  sem_resposta: 'Sem resposta',
  outro: 'Outro',
}

const CATEGORIA_NOTA_LABEL: Record<string, string> = {
  conversa: '💬 Conversa',
  objecao: '🚧 Objeção',
  concorrencia: '⚔️ Concorrência',
  oportunidade: '💡 Oportunidade',
  outro: '📝 Outro',
}

const TIPO_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  criacao: FileText,
  envio: Send,
  visualizacao: Eye,
  status: Sparkles,
  nota: MessageSquare,
  agenda: Calendar,
  whatsapp: Phone,
  email: PenLine,
  aceite: Trophy,
  recusa: XCircle,
  contrato: FileText,
  outro: ChevronRight,
}

const TIPO_COR: Record<string, string> = {
  criacao: 'var(--text-dim)',
  envio: 'var(--info)',
  visualizacao: 'var(--info)',
  status: 'var(--warning)',
  nota: 'var(--accent)',
  agenda: 'var(--text)',
  whatsapp: '#25D366',
  email: '#3B82F6',
  aceite: 'var(--success)',
  recusa: 'var(--danger)',
  contrato: 'var(--accent)',
  outro: 'var(--text-dim)',
}

export function PainelGestaoProposta({
  propostaId,
  statusInicial,
  onChange,
}: PainelGestaoPropostaProps) {
  const { success, error: showError } = useToast()
  const [info, setInfo] = useState<StatusInfo | null>(null)
  const [notas, setNotas] = useState<Nota[]>([])
  const [timeline, setTimeline] = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(true)

  // Form de nova nota
  const [novaNotaTexto, setNovaNotaTexto] = useState('')
  const [novaNotaCategoria, setNovaNotaCategoria] = useState<string>('conversa')
  const [salvandoNota, setSalvandoNota] = useState(false)

  // Form de novo agendamento
  const [agendaTitulo, setAgendaTitulo] = useState('')
  const [agendaDescricao, setAgendaDescricao] = useState('')
  const [agendaData, setAgendaData] = useState(() => {
    // Default: amanhã 10:00
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [salvandoAgenda, setSalvandoAgenda] = useState(false)
  const [mostrarFormAgenda, setMostrarFormAgenda] = useState(false)

  // Modal de mudar status
  const [statusDestino, setStatusDestino] = useState<string>('')
  const [lossReason, setLossReason] = useState<string>('preco')
  const [comentarioStatus, setComentarioStatus] = useState('')
  const [mudandoStatus, setMudandoStatus] = useState(false)

  const carregar = async () => {
    setLoading(true)
    try {
      const [s, n, t] = await Promise.all([
        fetch(`/api/propostas/${propostaId}/status`).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`/api/propostas/${propostaId}/notas`).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`/api/propostas/${propostaId}/timeline-staff`).then((r) =>
          r.ok ? r.json() : null
        ),
      ])
      if (s) setInfo(s as StatusInfo)
      if (n && Array.isArray(n.notas)) setNotas(n.notas as Nota[])
      if (t) setTimeline(t as TimelineData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostaId])

  const mudarStatus = async () => {
    if (!statusDestino) {
      showError('Selecione o novo status')
      return
    }
    setMudandoStatus(true)
    try {
      const body: Record<string, unknown> = {
        status: statusDestino,
        comentario: comentarioStatus.trim() || undefined,
      }
      if (statusDestino === 'perdida') {
        body.lossReason = lossReason
      }
      const r = await fetch(`/api/propostas/${propostaId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        showError(j.error || 'Falha ao mudar status')
        return
      }
      success(`Status atualizado para ${STATUS_LABEL[statusDestino] ?? statusDestino}`)
      setStatusDestino('')
      setComentarioStatus('')
      await carregar()
      onChange?.()
    } finally {
      setMudandoStatus(false)
    }
  }

  const adicionarNota = async () => {
    const texto = novaNotaTexto.trim()
    if (texto.length < 3) {
      showError('Nota muito curta')
      return
    }
    setSalvandoNota(true)
    try {
      const r = await fetch(`/api/propostas/${propostaId}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, categoria: novaNotaCategoria }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        showError(j.error || 'Erro ao salvar nota')
        return
      }
      success('Nota adicionada')
      setNovaNotaTexto('')
      await carregar()
    } finally {
      setSalvandoNota(false)
    }
  }

  const adicionarAgendamento = async () => {
    const titulo = agendaTitulo.trim()
    if (titulo.length < 3) {
      showError('Título obrigatório')
      return
    }
    if (!agendaData) {
      showError('Data obrigatória')
      return
    }
    setSalvandoAgenda(true)
    try {
      const r = await fetch(`/api/propostas/${propostaId}/agenda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          descricao: agendaDescricao.trim() || undefined,
          agendadoPara: new Date(agendaData).toISOString(),
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        showError(j.error || 'Erro ao agendar')
        return
      }
      success('Próximo contato agendado')
      setAgendaTitulo('')
      setAgendaDescricao('')
      setMostrarFormAgenda(false)
      await carregar()
    } finally {
      setSalvandoAgenda(false)
    }
  }

  const concluirAgendamento = async (agendaId: string, comentario?: string) => {
    const r = await fetch(`/api/propostas/${propostaId}/agenda/${agendaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'concluido', comentario }),
    })
    if (r.ok) {
      success('Agendamento concluído')
      await carregar()
    } else {
      showError('Falha ao concluir')
    }
  }

  const cancelarAgendamento = async (agendaId: string) => {
    if (!confirm('Cancelar este agendamento?')) return
    const r = await fetch(`/api/propostas/${propostaId}/agenda/${agendaId}`, {
      method: 'DELETE',
    })
    if (r.ok) {
      success('Cancelado')
      await carregar()
    }
  }

  if (loading) {
    return (
      <Card className="py-12 text-center">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </Card>
    )
  }

  const proximasAgendas = timeline?.proximas ?? []

  return (
    <div className="space-y-6">
      {/* === STATUS === */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="eyebrow">Gestão da proposta</p>
            <h3 className="text-fg-1 font-semibold mt-1">
              Status atual: {STATUS_LABEL[statusInicial] ?? statusInicial}
            </h3>
          </div>
          {info && info.destinosValidos.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                options={[
                  { value: '', label: 'Mover para…' },
                  ...info.destinosValidos.map((s) => ({
                    value: s,
                    label: STATUS_LABEL[s] ?? s,
                  })),
                ]}
                value={statusDestino}
                onChange={(e) => setStatusDestino(e.target.value)}
                containerClassName="w-56"
              />
            </div>
          )}
        </div>

        {statusDestino && (
          <div
            className="rounded-md p-3 space-y-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            {statusDestino === 'perdida' && (
              <Select
                label="Motivo da perda *"
                options={(info?.lossReasons ?? []).map((r) => ({
                  value: r,
                  label: LOSS_REASON_LABEL[r] ?? r,
                }))}
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
              />
            )}
            <div>
              <label className="eyebrow block mb-1.5">Comentário (opcional)</label>
              <textarea
                value={comentarioStatus}
                onChange={(e) => setComentarioStatus(e.target.value)}
                rows={2}
                placeholder="Detalhes da mudança de status…"
                className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 hover:border-border-2 focus:outline-none focus:ring-2 focus:ring-accent text-fg-1 text-body placeholder:text-fg-3 resize-y"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusDestino('')
                  setComentarioStatus('')
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={mudandoStatus}
                onClick={mudarStatus}
              >
                Confirmar mudança
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* === PRÓXIMOS CONTATOS === */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-accent" />
            <p className="eyebrow">
              Próximos contatos · {proximasAgendas.length}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setMostrarFormAgenda((v) => !v)}
          >
            {mostrarFormAgenda ? 'Fechar' : 'Agendar'}
          </Button>
        </div>

        {mostrarFormAgenda && (
          <div
            className="rounded-md p-3 space-y-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            <div>
              <label className="eyebrow block mb-1.5">Título *</label>
              <input
                type="text"
                value={agendaTitulo}
                onChange={(e) => setAgendaTitulo(e.target.value)}
                placeholder="Ex: Ligar para revisar proposta"
                className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 focus:outline-none focus:ring-2 focus:ring-accent text-fg-1 text-body"
                autoFocus
              />
            </div>
            <div>
              <label className="eyebrow block mb-1.5">Quando *</label>
              <input
                type="datetime-local"
                value={agendaData}
                onChange={(e) => setAgendaData(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 focus:outline-none focus:ring-2 focus:ring-accent text-fg-1 text-body"
              />
            </div>
            <div>
              <label className="eyebrow block mb-1.5">Descrição (opcional)</label>
              <textarea
                value={agendaDescricao}
                onChange={(e) => setAgendaDescricao(e.target.value)}
                rows={2}
                placeholder="Detalhes do que tratar"
                className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 focus:outline-none focus:ring-2 focus:ring-accent text-fg-1 text-body placeholder:text-fg-3 resize-y"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={salvandoAgenda}
                onClick={adicionarAgendamento}
              >
                Agendar
              </Button>
            </div>
          </div>
        )}

        {proximasAgendas.length === 0 && !mostrarFormAgenda ? (
          <p className="text-fg-3 text-small text-center py-3">
            Nenhum contato agendado.
          </p>
        ) : (
          <div className="space-y-2">
            {proximasAgendas.map((a) => {
              const id = a.id.replace('a-', '')
              const data = new Date(a.em)
              const venceuEm = data.getTime() - Date.now()
              const ehUrgente = venceuEm < 24 * 60 * 60 * 1000
              return (
                <div
                  key={a.id}
                  className="rounded-md p-3 flex items-start justify-between gap-2"
                  style={{
                    background: ehUrgente ? 'rgba(248,113,113,0.08)' : 'var(--surface-2)',
                    border: `1px solid ${ehUrgente ? 'rgba(248,113,113,0.3)' : 'var(--border)'}`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-fg-1 font-medium text-small">
                      {a.label.replace('Agendado: ', '')}
                    </p>
                    {a.detalhe && (
                      <p className="text-fg-3 text-[11px] mt-0.5">{a.detalhe}</p>
                    )}
                    <p
                      className="text-[11px] mt-1 tabular-nums"
                      style={{
                        color: ehUrgente ? 'var(--danger)' : 'var(--text-dim)',
                      }}
                    >
                      📅{' '}
                      {data.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {a.autor && <span> · {a.autor}</span>}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => concluirAgendamento(id)}
                      className="chip"
                      style={{ padding: '4px 8px', fontSize: 10 }}
                      title="Marcar como feito"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelarAgendamento(id)}
                      className="chip"
                      style={{ padding: '4px 8px', fontSize: 10 }}
                      title="Cancelar"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* === NOTAS RÁPIDAS === */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-accent" />
          <p className="eyebrow">Adicionar nota</p>
        </div>
        <div className="space-y-2">
          <textarea
            value={novaNotaTexto}
            onChange={(e) => setNovaNotaTexto(e.target.value)}
            rows={3}
            placeholder="Ex: Cliente pediu prazo de 7d. Está comparando com a Cargill."
            className="w-full px-3 py-2 rounded-md bg-bg-2 border border-border-1 focus:outline-none focus:ring-2 focus:ring-accent text-fg-1 text-body placeholder:text-fg-3 resize-y"
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Select
              options={Object.entries(CATEGORIA_NOTA_LABEL).map(([v, l]) => ({
                value: v,
                label: l,
              }))}
              value={novaNotaCategoria}
              onChange={(e) => setNovaNotaCategoria(e.target.value)}
              containerClassName="w-44"
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={salvandoNota}
              disabled={novaNotaTexto.trim().length < 3}
              onClick={adicionarNota}
            >
              Adicionar
            </Button>
          </div>
        </div>

        {notas.length > 0 && (
          <div className="space-y-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="eyebrow">Notas anteriores · {notas.length}</p>
            {notas.slice(0, 5).map((n) => (
              <div
                key={n.id}
                className="rounded-md p-2.5"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-dim)' }}>
                    {new Date(n.criadaEm).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {n.autorNome && <span> · {n.autorNome}</span>}
                  </span>
                  {n.categoria && (
                    <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                      {CATEGORIA_NOTA_LABEL[n.categoria] ?? n.categoria}
                    </span>
                  )}
                </div>
                <p className="text-fg-1 text-small whitespace-pre-wrap">{n.texto}</p>
              </div>
            ))}
            {notas.length > 5 && (
              <p className="text-fg-3 text-[11px] text-center">
                +{notas.length - 5} notas mais antigas na timeline abaixo
              </p>
            )}
          </div>
        )}
      </Card>

      {/* === TIMELINE COMPLETA === */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <p className="eyebrow">Histórico completo</p>
        </div>
        {timeline && timeline.events.length > 0 ? (
          <ol className="space-y-3">
            {[...timeline.events].reverse().map((e, i) => {
              const Icon = TIPO_ICON[e.tipo] ?? ChevronRight
              const cor = TIPO_COR[e.tipo] ?? 'var(--text-dim)'
              const isLast = i === timeline.events.length - 1
              return (
                <li key={e.id} className="relative flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full"
                      style={{ background: `${cor}22`, color: cor }}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    {!isLast && (
                      <span
                        className="mt-1 w-px flex-1"
                        style={{ background: 'var(--border)', minHeight: 12 }}
                      />
                    )}
                  </div>
                  <div className="flex-1 pb-2 min-w-0">
                    <p className="text-fg-1 text-small font-medium">{e.label}</p>
                    {e.detalhe && (
                      <p className="text-fg-3 text-[11px] mt-0.5 whitespace-pre-wrap">
                        {e.detalhe}
                      </p>
                    )}
                    <p
                      className="text-[10px] tabular-nums mt-0.5"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      {new Date(e.em).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {e.autor && <span> · {e.autor}</span>}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="text-fg-3 text-small text-center py-4">
            Sem eventos registrados ainda.
          </p>
        )}
      </Card>
    </div>
  )
}
