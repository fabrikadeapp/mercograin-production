'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageCircle, Mail, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { GlassCard } from '@/app/bhgrain/_components/_shared'

interface SaudeResumo {
  janelas: {
    '24h': {
      whatsapp: { total: number; taxaSucesso: number; deliveryRate?: number }
      email: { total: number; taxaSucesso: number }
    }
  }
  whatsappInstance: { status: string; phoneNumber: string | null } | null
}

const fmtPct = (n: number, total: number) => (total === 0 ? '—' : `${(n * 100).toFixed(0)}%`)

const corPct = (n: number, total: number): string => {
  if (total === 0) return 'var(--text-dim)'
  if (n >= 0.95) return 'var(--success)'
  if (n >= 0.8) return 'var(--warning)'
  return 'var(--danger)'
}

export function SaudeCardCompacto() {
  const [data, setData] = useState<SaudeResumo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notificacoes/saude')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setData(j as SaudeResumo)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <GlassCard title="Saúde das notificações · 24h" subtitle="Carregando…">
        <div className="h-16" />
      </GlassCard>
    )
  }

  if (!data) {
    return null
  }

  const wa = data.janelas['24h'].whatsapp
  const em = data.janelas['24h'].email
  const instOK = data.whatsappInstance?.status === 'connected'

  return (
    <GlassCard
      title="Saúde das notificações · 24h"
      subtitle={instOK ? 'Instância WhatsApp conectada' : 'Atenção · revisar instância'}
      action={
        <Link
          href="/bhgrain/saude-notificacoes"
          className="flex items-center gap-1 text-[11px]"
          style={{ color: 'var(--accent)' }}
        >
          Ver detalhes
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* WhatsApp */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-mute)' }}>
            <MessageCircle className="h-3 w-3" />
            <span className="eyebrow" style={{ fontSize: 10 }}>WhatsApp</span>
          </div>
          <p
            className="tabular-nums"
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: corPct(wa.taxaSucesso, wa.total),
              margin: 0,
              lineHeight: 1,
            }}
          >
            {fmtPct(wa.taxaSucesso, wa.total)}
          </p>
          <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '4px 0 0 0' }}>
            {wa.total} envios · {wa.deliveryRate != null ? `${(wa.deliveryRate * 100).toFixed(0)}% entregues` : '—'}
          </p>
        </div>

        {/* Email */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-mute)' }}>
            <Mail className="h-3 w-3" />
            <span className="eyebrow" style={{ fontSize: 10 }}>Email</span>
          </div>
          <p
            className="tabular-nums"
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: corPct(em.taxaSucesso, em.total),
              margin: 0,
              lineHeight: 1,
            }}
          >
            {fmtPct(em.taxaSucesso, em.total)}
          </p>
          <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '4px 0 0 0' }}>
            {em.total} envios
          </p>
        </div>

        {/* Status instância */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-mute)' }}>
            {instOK ? (
              <CheckCircle2 className="h-3 w-3" style={{ color: 'var(--success)' }} />
            ) : (
              <AlertTriangle className="h-3 w-3" style={{ color: 'var(--danger)' }} />
            )}
            <span className="eyebrow" style={{ fontSize: 10 }}>Instância</span>
          </div>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: instOK ? 'var(--success)' : 'var(--danger)',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {instOK ? 'Conectada' : 'Desconectada'}
          </p>
          <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '4px 0 0 0' }}>
            {data.whatsappInstance?.phoneNumber ?? 'sem número'}
          </p>
        </div>
      </div>
    </GlassCard>
  )
}
