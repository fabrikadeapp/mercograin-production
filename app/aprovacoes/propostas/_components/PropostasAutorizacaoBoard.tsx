'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Phone,
  MessageCircle,
  Bot,
  Check,
  X,
  ExternalLink,
  Clock,
} from 'lucide-react'
import { StatusTimeline, type TimelineStep } from '@/components/ui/StatusTimeline'

interface Proposta {
  id: string
  numero: string
  tipo: string
  valorTotal: string
  graos: any
  criadaEm: string
  validadeEm: string
  canalAutorizacao: string | null
  observacoes: string | null
  descricao: string | null
  cliente: { id: string; nome: string; whatsapp: string | null } | null
  gerenteConta: {
    id: string
    email: string
    user: { nome: string | null } | null
  } | null
}

const CANAL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  ia_autonomo: 'IA autônoma',
  web: 'Web',
}

const CANAL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  telefone: Phone,
  ia_autonomo: Bot,
}

function brl(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n)
}

function ageMinutes(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}m`
  if (min < 60 * 24) return `há ${Math.floor(min / 60)}h`
  return `há ${Math.floor(min / 60 / 24)}d`
}

export function PropostasAutorizacaoBoard({ initial }: { initial: Proposta[] }) {
  const [list, setList] = useState<Proposta[]>(initial)

  const handleAfter = (id: string) => {
    setList((cur) => cur.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-4">
      <header style={{ paddingTop: 4 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          MESA · AUTORIZAÇÕES PENDENTES
        </div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              Propostas aguardando você
            </h1>
            <p
              style={{
                marginTop: 6,
                fontSize: 13,
                color: 'var(--text-mute)',
                maxWidth: 640,
              }}
            >
              Propostas criadas por Laura.IA via WhatsApp, telefone ou ofertas
              automáticas. Quem aprovar fica registrado como vendedor da
              negociação.
            </p>
          </div>
          <div
            style={{
              padding: '6px 12px',
              fontSize: 12,
              borderRadius: 'var(--r-pill)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            {list.length} pendente{list.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>

      {list.length === 0 ? (
        <section
          className="sec-card"
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--text-dim)',
          }}
        >
          Nenhuma proposta aguardando autorização no momento.
        </section>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          }}
        >
          {list.map((p) => (
            <PropostaCard
              key={p.id}
              proposta={p}
              onResolved={() => handleAfter(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PropostaCard({
  proposta,
  onResolved,
}: {
  proposta: Proposta
  onResolved: () => void
}) {
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [confirmingReject, setConfirmingReject] = useState(false)
  const [motivo, setMotivo] = useState('')

  const canal = proposta.canalAutorizacao ?? 'web'
  const Icon = CANAL_ICON[canal] ?? Bot
  const graos = Array.isArray(proposta.graos) ? proposta.graos : []

  const decidir = (acao: 'aprovar' | 'rejeitar') => {
    setErr(null)
    startTransition(async () => {
      const res = await fetch(`/api/propostas/${proposta.id}/autorizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao,
          observacao: acao === 'rejeitar' ? motivo || undefined : undefined,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(j.error || 'Erro ao decidir.')
        return
      }
      onResolved()
    })
  }

  return (
    <section
      className="sec-card"
      style={{
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <Icon className="w-3 h-3" />
            {CANAL_LABEL[canal] ?? canal}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Clock className="w-3 h-3" />
            {ageMinutes(proposta.criadaEm)}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--f-mono)',
            color: 'var(--text-dim)',
          }}
        >
          {proposta.numero}
        </span>
      </header>

      <div style={{ padding: 16, flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontFamily: 'var(--f-mono)',
            marginBottom: 4,
          }}
        >
          Cliente
        </div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          {proposta.cliente?.nome ?? '—'}
        </div>
        {proposta.cliente?.whatsapp && (
          <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-mute)' }}>
            WhatsApp {proposta.cliente.whatsapp}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontFamily: 'var(--f-mono)',
              marginBottom: 4,
            }}
          >
            {proposta.tipo === 'venda' ? 'Venda' : 'Compra'} ·{' '}
            {brl(Number(proposta.valorTotal))}
          </div>
          <ul style={{ paddingLeft: 16, margin: 0, fontSize: 12 }}>
            {graos.map((g: any, i: number) => (
              <li key={i} style={{ color: 'var(--text)' }}>
                {g.quantidade} sc {g.grao} a{' '}
                {brl(Number(g.preco))} ={' '}
                <b>{brl(Number(g.subtotal))}</b>
              </li>
            ))}
          </ul>
        </div>

        {proposta.gerenteConta && (
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-mute)' }}>
            Gerente da conta:{' '}
            <b style={{ color: 'var(--text)' }}>
              {proposta.gerenteConta.user?.nome ?? proposta.gerenteConta.email}
            </b>
          </div>
        )}

        {/* Timeline compacta — visual rápido do fluxo */}
        <div style={{ marginTop: 14 }}>
          <StatusTimeline
            size="sm"
            steps={
              [
                { label: 'Recebida', state: 'done', at: proposta.criadaEm },
                { label: 'Aut. pendente', state: 'current' },
                { label: 'Enviada', state: 'pending' },
                { label: 'Aceita', state: 'pending' },
                { label: 'Contrato', state: 'pending' },
                { label: 'Pago', state: 'pending' },
              ] as TimelineStep[]
            }
          />
        </div>

        {proposta.observacoes && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 10px',
              fontSize: 12,
              background: 'var(--surface-2)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text-mute)',
              borderLeft: '2px solid var(--accent)',
            }}
          >
            {proposta.observacoes}
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            color: 'var(--text-dim)',
          }}
        >
          Vence em {new Date(proposta.validadeEm).toLocaleDateString('pt-BR')}
        </div>

        <Link
          href={`/propostas/${proposta.id}`}
          style={{
            marginTop: 12,
            fontSize: 11,
            color: 'var(--text-dim)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            textDecoration: 'none',
          }}
        >
          Ver detalhes <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {confirmingReject && (
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--surface-2)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo da rejeição (opcional)"
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
      )}

      {err && (
        <div
          style={{
            padding: '8px 16px',
            fontSize: 11,
            color: 'var(--danger, #ff5050)',
            background: 'rgba(255,80,80,0.08)',
          }}
        >
          {err}
        </div>
      )}

      <footer
        style={{
          padding: 12,
          display: 'flex',
          gap: 8,
          background: 'var(--surface-2)',
          borderTop: '1px solid var(--border)',
        }}
      >
        {!confirmingReject ? (
          <>
            <button
              type="button"
              className="btn ghost"
              style={{ flex: 1 }}
              disabled={pending}
              onClick={() => setConfirmingReject(true)}
            >
              <X className="w-3.5 h-3.5" /> Rejeitar
            </button>
            <button
              type="button"
              className="btn primary"
              style={{ flex: 2 }}
              disabled={pending}
              onClick={() => decidir('aprovar')}
            >
              <Check className="w-3.5 h-3.5" />
              {pending ? 'Aprovando…' : 'Aprovar e enviar'}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn ghost"
              style={{ flex: 1 }}
              onClick={() => setConfirmingReject(false)}
              disabled={pending}
            >
              Cancelar
            </button>
            <button
              type="button"
              style={{
                flex: 2,
                padding: '8px 12px',
                background: 'var(--danger, #ff5050)',
                color: '#fff',
                border: 0,
                borderRadius: 'var(--r-pill)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
              disabled={pending}
              onClick={() => decidir('rejeitar')}
            >
              {pending ? 'Rejeitando…' : 'Confirmar rejeição'}
            </button>
          </>
        )}
      </footer>
    </section>
  )
}
