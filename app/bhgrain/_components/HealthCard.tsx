'use client'

import { useState, useTransition } from 'react'
import { Activity, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Skeleton, ErrorState, EmptyState, useJson } from './_shared'

interface IntegrationHealth {
  integration: string
  status: 'online' | 'instavel' | 'atraso' | 'erro' | 'desconectada'
  lastSuccessAt: string | null
  responseTimeMs: number | null
  pendingEvents: number
  processedEvents: number
  lastErrorMessage: string | null
  /** Toggle do usuário — quando true, workers pulam essa integração. */
  paused: boolean
  pausedUntil: string | null
  pausedBy: string | null
  pausedReason: string | null
  updatedAt: string
}

const INTEGRATION_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  instagram: 'Instagram',
  portal: 'Portal',
  precos: 'Preços',
  ia: 'IA',
  financeiro: 'Financeiro',
}

/**
 * Cor do dot do toggle:
 *  - cinza  : pausado (intenção do usuário)
 *  - verde  : online
 *  - amarelo: instável/atraso
 *  - vermelho: erro/desconectado
 */
function dotColor(h: IntegrationHealth): string {
  if (h.paused) return 'var(--text-dim)'
  if (h.status === 'online') return 'var(--success)'
  if (h.status === 'instavel' || h.status === 'atraso') return 'var(--warning)'
  return 'var(--danger)'
}

function statusLabel(h: IntegrationHealth): string {
  if (h.paused) {
    if (h.pausedUntil) {
      const d = new Date(h.pausedUntil)
      return `Pausado até ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    }
    return 'Pausado'
  }
  switch (h.status) {
    case 'online': return 'Online'
    case 'instavel': return 'Instável'
    case 'atraso': return 'Atraso'
    case 'erro': return 'Erro'
    case 'desconectada': return 'Desconectada'
  }
}

function ageText(iso: string | null): string {
  if (!iso) return '—'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}m`
  if (min < 60 * 24) return `${Math.floor(min / 60)}h`
  return `${Math.floor(min / 60 / 24)}d`
}

/**
 * Health de integrações — versão horizontal com toggle por canal.
 * Cada chip vira ON/OFF; cinza = pausado, verde = online, vermelho = erro.
 */
export function HealthCard() {
  const { data, error, loading } = useJson<{ integrations: IntegrationHealth[] }>(
    '/api/bhgrain/health',
    [],
    { pollMs: 60_000 }
  )

  return (
    <section
      className="sec-card"
      style={{ padding: '6px 14px', minHeight: 36 }}
    >
      <div className="flex items-center gap-3 w-full">
        <div className="flex items-center gap-1.5 shrink-0">
          <Activity className="w-3 h-3" style={{ color: 'var(--text-dim)' }} />
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--f-mono)',
              color: 'var(--text-dim)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Health · integrações
          </span>
        </div>

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex gap-2 justify-between">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-5 w-24" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message="Erro" />
          ) : !data?.integrations || data.integrations.length === 0 ? (
            <EmptyState message="Aguardando primeiro cron…" />
          ) : (
            <ul
              className="flex items-center"
              style={{
                gap: 4,
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              {data.integrations.map((h) => (
                <IntegrationChip key={h.integration} health={h} />
              ))}
            </ul>
          )}
        </div>

        <Link
          href="/admin/bhgrain/integracoes"
          className="shrink-0"
          style={{ fontSize: 10, color: 'var(--text-dim)' }}
        >
          Detalhes →
        </Link>
      </div>
    </section>
  )
}

/**
 * Chip de uma integração com toggle ON/OFF.
 * Visual: pílula com toggle switch (esfera deslizante) + label + idade.
 */
function IntegrationChip({ health: h }: { health: IntegrationHealth }) {
  const [pending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [reviewBacklog, setReviewBacklog] = useState<{ count: number } | null>(null)

  // Estado efetivo: optimistic (em-flight) ou do server
  const paused = optimistic !== null ? optimistic : h.paused
  const isOn = !paused
  const label = INTEGRATION_LABEL[h.integration] ?? h.integration
  const color = h.paused ? 'var(--text-dim)' : dotColor(h)

  const toggle = (pausedUntil?: Date | null, pausedReason?: string) => {
    const wasPaused = paused
    const nextPaused = !paused
    setOptimistic(nextPaused)
    startTransition(async () => {
      try {
        const res = await fetch('/api/bhgrain/health/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            integration: h.integration,
            paused: nextPaused,
            pausedUntil: pausedUntil?.toISOString() ?? null,
            pausedReason: pausedReason ?? null,
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        // Acabou de REATIVAR (paused → ON)? Conferir se há silenciadas
        if (wasPaused && !nextPaused) {
          try {
            const r = await fetch('/api/bhgrain/health/silenced')
            const j = (await r.json()) as { byChannel?: Record<string, number> }
            const count = j.byChannel?.[h.integration] ?? 0
            if (count > 0) setReviewBacklog({ count })
          } catch {
            /* silencioso */
          }
        }
      } catch {
        setOptimistic(null) // reverte
      }
    })
  }

  const processBacklog = async (action: 'process' | 'mark_read' | 'discard') => {
    try {
      await fetch('/api/bhgrain/health/silenced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration: h.integration, action }),
      })
    } catch {
      /* silencioso */
    } finally {
      setReviewBacklog(null)
    }
  }

  const tooltip = [
    `${label}: ${statusLabel(h)}`,
    h.lastSuccessAt && !h.paused ? `Última sync ${ageText(h.lastSuccessAt)}` : null,
    h.pendingEvents > 0 ? `${h.pendingEvents} pendentes` : null,
    h.lastErrorMessage && !h.paused ? h.lastErrorMessage : null,
    h.pausedReason ? `Motivo: ${h.pausedReason}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="relative">
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={`${isOn ? 'Desligar' : 'Ligar'} ${label}`}
        onClick={() => toggle()}
        onContextMenu={(e) => {
          e.preventDefault()
          setScheduleOpen((v) => !v)
        }}
        disabled={pending}
        title={`${tooltip} · Clique para ${isOn ? 'pausar' : 'reativar'} · Botão direito para pausar com prazo`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          fontSize: 10,
          lineHeight: 1.4,
          opacity: paused ? 0.55 : 1,
          cursor: pending ? 'wait' : 'pointer',
          transition: '150ms ease',
          fontFamily: 'inherit',
        }}
      >
        {/* Dot de status — pequeno, igual ao resto do app */}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            boxShadow: !paused && h.status === 'online' ? `0 0 6px ${color}66` : 'none',
            flexShrink: 0,
            transition: '150ms ease',
          }}
        />

        <span
          style={{
            color: paused ? 'var(--text-dim)' : 'var(--text)',
            fontWeight: 500,
            textDecoration: paused ? 'line-through' : 'none',
            textDecorationColor: 'var(--text-dim)',
            textDecorationThickness: '1px',
          }}
        >
          {label}
        </span>

        {!paused && h.lastSuccessAt && (
          <span
            style={{
              fontFamily: 'var(--f-mono)',
              color: 'var(--text-dim)',
              fontSize: 10,
              letterSpacing: '0.02em',
            }}
          >
            {ageText(h.lastSuccessAt)}
          </span>
        )}
        {h.pendingEvents > 0 && !paused && (
          <span
            style={{
              color: 'var(--warning)',
              fontFamily: 'var(--f-mono)',
              fontSize: 10,
            }}
          >
            ·{h.pendingEvents}
          </span>
        )}

        {pending && <Loader2 className="w-2.5 h-2.5 animate-spin" style={{ opacity: 0.6 }} />}
      </button>

      {/* Popover de agendamento (clique direito ou botão "..." futuro) */}
      {scheduleOpen && !pending && (
        <PauseSchedulePopover
          onClose={() => setScheduleOpen(false)}
          onPause={(until, reason) => {
            setScheduleOpen(false)
            toggle(until, reason)
          }}
          currentlyPaused={paused}
        />
      )}

      {/* Modal de revisão do backlog silenciado — aparece ao REATIVAR */}
      {reviewBacklog && (
        <ReviewBacklogModal
          label={label}
          count={reviewBacklog.count}
          onAction={processBacklog}
          onClose={() => setReviewBacklog(null)}
        />
      )}
    </li>
  )
}

function ReviewBacklogModal({
  label,
  count,
  onAction,
  onClose,
}: {
  label: string
  count: number
  onAction: (a: 'process' | 'mark_read' | 'discard') => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            {label} reativado
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>
            {count} {count === 1 ? 'mensagem silenciada' : 'mensagens silenciadas'} durante a pausa
          </h3>
          <p
            className="mt-1"
            style={{ fontSize: 12, color: 'var(--text-mute)' }}
          >
            O que fazer com essas mensagens?
          </p>
        </header>

        <div className="p-5 space-y-2">
          <button
            type="button"
            onClick={() => onAction('process')}
            className="w-full text-left transition"
            style={{
              padding: 14,
              borderRadius: 'var(--r-md)',
              background: 'var(--accent-soft)',
              border: '1px solid rgba(200, 240, 81, 0.25)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = 'rgba(200, 240, 81, 0.25)')
            }
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
              Processar tudo
            </div>
            <div className="mt-1" style={{ fontSize: 11, color: 'var(--text-mute)' }}>
              Marcar todas como não-lidas, IA classifica e elas voltam ao Inbox normalmente.
            </div>
          </button>

          <button
            type="button"
            onClick={() => onAction('mark_read')}
            className="w-full text-left transition"
            style={{
              padding: 14,
              borderRadius: 'var(--r-md)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Marcar todas como lidas
            </div>
            <div className="mt-1" style={{ fontSize: 11, color: 'var(--text-mute)' }}>
              Tira o silêncio e marca como lida — ainda ficam no Inbox para revisar manualmente.
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  `Descartar ${count} mensagens? Esta ação é irrecuperável.`
                )
              ) {
                onAction('discard')
              }
            }}
            className="w-full text-left transition"
            style={{
              padding: 14,
              borderRadius: 'var(--r-md)',
              background: 'transparent',
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--danger-soft)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>
              Descartar tudo
            </div>
            <div className="mt-1" style={{ fontSize: 11, color: 'var(--text-mute)' }}>
              Apaga permanentemente. Útil se eram spam ou avisos automáticos irrelevantes.
            </div>
          </button>
        </div>

        <footer
          className="px-5 py-3 flex items-center justify-end"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn ghost"
            style={{ fontSize: 12 }}
          >
            Decidir depois
          </button>
        </footer>
      </div>
    </div>
  )
}

/**
 * Popover compacto para escolher quanto tempo pausar a integração.
 * Abre com botão direito no toggle.
 */
function PauseSchedulePopover({
  onClose,
  onPause,
  currentlyPaused,
}: {
  onClose: () => void
  onPause: (until: Date | null, reason: string) => void
  currentlyPaused: boolean
}) {
  const presets = [
    { label: '1 hora', mins: 60 },
    { label: 'Resto do dia', mins: -1 }, // calcula até 23:59
    { label: 'Até segunda 9h', mins: -2 }, // calcula próximo dia útil
    { label: '1 semana', mins: 60 * 24 * 7 },
    { label: 'Indefinido', mins: 0 },
  ]

  const calcUntil = (mins: number): Date | null => {
    if (mins === 0) return null
    if (mins > 0) return new Date(Date.now() + mins * 60_000)
    if (mins === -1) {
      // Final do dia
      const d = new Date()
      d.setHours(23, 59, 59, 999)
      return d
    }
    if (mins === -2) {
      // Próxima segunda-feira às 9:00
      const d = new Date()
      const today = d.getDay() // 0 dom, 1 seg ... 6 sab
      const daysUntilMonday = today === 1 ? 7 : (8 - today) % 7 || 7
      d.setDate(d.getDate() + daysUntilMonday)
      d.setHours(9, 0, 0, 0)
      return d
    }
    return null
  }

  return (
    <>
      {/* Backdrop invisível pra fechar ao clicar fora */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute z-50 mt-1"
        style={{
          left: 0,
          top: '100%',
          minWidth: 200,
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          boxShadow: 'var(--sh-3)',
          padding: 6,
        }}
      >
        <div
          className="eyebrow"
          style={{ padding: '4px 8px', fontSize: 10, marginBottom: 4 }}
        >
          {currentlyPaused ? 'Reagendar pausa' : 'Pausar até'}
        </div>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onPause(calcUntil(p.mins), p.label)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--text)',
              borderRadius: 'var(--r-sm)',
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tint-4pct)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {p.label}
          </button>
        ))}
      </div>
    </>
  )
}
