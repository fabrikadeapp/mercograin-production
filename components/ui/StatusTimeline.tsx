'use client'

import { Check } from 'lucide-react'

/**
 * StatusTimeline — barra horizontal de etapas com pills.
 *
 * Cada etapa pode estar:
 *   - 'done': já concluída (verde sólido)
 *   - 'current': em andamento (amarelo pulsando)
 *   - 'pending': futura (cinza outline)
 *   - 'skipped': pulou (cinza riscado)
 *
 * Uso típico no fluxo de contrato:
 *   <StatusTimeline
 *     steps={[
 *       { label: 'Proposta', state: 'done' },
 *       { label: 'Aceita', state: 'done' },
 *       { label: 'Contrato', state: 'current' },
 *       { label: 'Assinatura', state: 'pending' },
 *       { label: 'Boleto', state: 'pending' },
 *       { label: 'Pago', state: 'pending' },
 *     ]}
 *   />
 */

export type TimelineState = 'done' | 'current' | 'pending' | 'skipped'

export interface TimelineStep {
  label: string
  state: TimelineState
  /** Opcional: data/hora quando completou (mostrado em tooltip) */
  at?: string | Date | null
  /** Opcional: link clicável */
  href?: string
}

interface Props {
  steps: TimelineStep[]
  size?: 'sm' | 'md'
  /** Layout: 'linear' (default, barra) ou 'compact' (chips só) */
  variant?: 'linear' | 'compact'
}

const STATE_COLORS: Record<
  TimelineState,
  { bg: string; fg: string; border: string; dotBg: string; line: string }
> = {
  done: {
    bg: 'rgba(64, 200, 100, 0.15)',
    fg: 'var(--success, #40c864)',
    border: 'var(--success, #40c864)',
    dotBg: 'var(--success, #40c864)',
    line: 'var(--success, #40c864)',
  },
  current: {
    bg: 'rgba(255, 180, 0, 0.15)',
    fg: 'var(--warning, #ffb400)',
    border: 'var(--warning, #ffb400)',
    dotBg: 'var(--warning, #ffb400)',
    line: 'var(--border, rgba(255,255,255,0.08))',
  },
  pending: {
    bg: 'transparent',
    fg: 'var(--text-dim, rgba(255,255,255,0.4))',
    border: 'var(--border, rgba(255,255,255,0.08))',
    dotBg: 'var(--surface-2, rgba(255,255,255,0.05))',
    line: 'var(--border, rgba(255,255,255,0.08))',
  },
  skipped: {
    bg: 'transparent',
    fg: 'var(--text-dim, rgba(255,255,255,0.3))',
    border: 'var(--border, rgba(255,255,255,0.08))',
    dotBg: 'var(--surface-2, rgba(255,255,255,0.05))',
    line: 'var(--border, rgba(255,255,255,0.08))',
  },
}

export function StatusTimeline({ steps, size = 'md', variant = 'linear' }: Props) {
  if (variant === 'compact') {
    return (
      <div
        style={{
          display: 'inline-flex',
          gap: 4,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {steps.map((step, i) => (
          <Pill key={i} step={step} size={size} />
        ))}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        width: '100%',
        gap: 0,
      }}
    >
      {steps.map((step, i) => {
        const c = STATE_COLORS[step.state]
        const isLast = i === steps.length - 1
        const isDoneOrCurrent = step.state === 'done' || step.state === 'current'
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              minWidth: 0,
            }}
            title={
              step.at
                ? `${step.label} · ${new Date(step.at).toLocaleString('pt-BR')}`
                : step.label
            }
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
              }}
            >
              {/* Linha antes (não no primeiro) */}
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background:
                    i === 0
                      ? 'transparent'
                      : isDoneOrCurrent
                        ? STATE_COLORS.done.line
                        : c.line,
                }}
              />
              {/* Dot/check */}
              <div
                style={{
                  width: size === 'sm' ? 18 : 22,
                  height: size === 'sm' ? 18 : 22,
                  borderRadius: '50%',
                  background: c.dotBg,
                  border: `2px solid ${c.border}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                {step.state === 'done' && (
                  <Check
                    style={{
                      width: size === 'sm' ? 10 : 12,
                      height: size === 'sm' ? 10 : 12,
                      color: 'var(--bg, #000)',
                      strokeWidth: 3,
                    }}
                  />
                )}
                {step.state === 'current' && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: -4,
                      borderRadius: '50%',
                      border: `2px solid ${c.dotBg}`,
                      opacity: 0.4,
                      animation: 'pulse-status 1.6s ease-in-out infinite',
                    }}
                  />
                )}
              </div>
              {/* Linha depois (não no último) */}
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: isLast
                    ? 'transparent'
                    : step.state === 'done'
                      ? STATE_COLORS.done.line
                      : c.line,
                }}
              />
            </div>
            {/* Label */}
            <div
              style={{
                marginTop: 6,
                fontSize: size === 'sm' ? 10 : 11,
                fontFamily: 'var(--f-mono)',
                color: c.fg,
                textAlign: 'center',
                fontWeight: step.state === 'current' ? 600 : 400,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textDecoration:
                  step.state === 'skipped' ? 'line-through' : 'none',
              }}
            >
              {step.label}
            </div>
          </div>
        )
      })}
      <style jsx global>{`
        @keyframes pulse-status {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.1;
          }
        }
      `}</style>
    </div>
  )
}

function Pill({ step, size }: { step: TimelineStep; size: 'sm' | 'md' }) {
  const c = STATE_COLORS[step.state]
  return (
    <span
      title={
        step.at
          ? `${step.label} · ${new Date(step.at).toLocaleString('pt-BR')}`
          : step.label
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
        fontSize: size === 'sm' ? 10 : 11,
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        fontWeight: step.state === 'current' ? 600 : 500,
        textDecoration: step.state === 'skipped' ? 'line-through' : 'none',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        fontFamily: 'var(--f-mono)',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: c.dotBg,
          flexShrink: 0,
        }}
      />
      {step.label}
    </span>
  )
}

// ============================================================================
// Helpers — derivam steps a partir do schema do contrato/proposta
// ============================================================================

export interface ContratoTimelineInput {
  proposta?: { status?: string | null; criadaEm?: Date | string | null; enviadaEm?: Date | string | null } | null
  contrato: {
    statusAssinatura?: string | null
    assinadoEm?: Date | string | null
    criadoEm?: Date | string | null
  }
  /** Boletos existem? algum pago? */
  temBoleto?: boolean
  boletoPago?: boolean
  /** Entregue (status logística futura) */
  entregue?: boolean
}

/**
 * Deriva os 6 passos do fluxo padrão de Mesa:
 * Proposta → Enviada → Aceita → Contrato → Assinado → Pago
 */
export function buildContratoTimeline(
  input: ContratoTimelineInput,
): TimelineStep[] {
  const p = input.proposta ?? {}
  const c = input.contrato
  const propAceita = p.status === 'aceita'
  const propRejeitada = p.status === 'rejeitada' || p.status === 'cancelada'
  const propEnviada = !!p.enviadaEm || ['enviada', 'em_negociacao', 'aceita', 'rejeitada'].includes(p.status ?? '')
  const contratoExiste = !!c.criadoEm
  const assinado = c.statusAssinatura === 'assinado' || !!c.assinadoEm
  const pago = !!input.boletoPago

  return [
    {
      label: 'Proposta',
      state: 'done',
      at: p.criadaEm ?? null,
    },
    {
      label: 'Enviada',
      state: propEnviada ? 'done' : propRejeitada ? 'skipped' : 'current',
      at: p.enviadaEm ?? null,
    },
    {
      label: propRejeitada ? 'Rejeitada' : 'Aceita',
      state: propAceita
        ? 'done'
        : propRejeitada
          ? 'skipped'
          : propEnviada
            ? 'current'
            : 'pending',
    },
    {
      label: 'Contrato',
      state: contratoExiste ? 'done' : propAceita ? 'current' : 'pending',
      at: c.criadoEm ?? null,
    },
    {
      label: 'Assinado',
      state: assinado ? 'done' : contratoExiste ? 'current' : 'pending',
      at: c.assinadoEm ?? null,
    },
    {
      label: 'Pago',
      state: pago ? 'done' : assinado ? 'current' : 'pending',
    },
  ]
}
