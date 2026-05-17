'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, Users, Briefcase, FileCheck, Target, BarChart3 } from 'lucide-react'
import { FUNCAO_LABEL, type Funcao } from '@/lib/equipe/funcoes'
import { AREA_LABEL, type Area } from '@/lib/areas'

interface PerformanceResp {
  member: {
    id: string
    nome: string
    email: string
    cargo: string | null
    funcoes: string[]
    role: string
    areasPermitidas: string[]
  }
  periodo: 'mes' | 'trim' | 'ano'
  inicio: string
  fim: string
  metricas: {
    clientesAtivos: number
    propostasCriadas: number
    valorPropostas: number
    contratosFechados: number
    gmv: number
    taxaConversao: number
    ticketMedio: number
  }
}

const PERIODO_LABEL: Record<'mes' | 'trim' | 'ano', string> = {
  mes: '30 dias',
  trim: '90 dias',
  ano: '12 meses',
}

function brl(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(n)
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

export function MemberPerformance({
  memberId,
  memberName,
}: {
  memberId: string
  memberName: string
}) {
  const [periodo, setPeriodo] = useState<'mes' | 'trim' | 'ano'>('mes')
  const [data, setData] = useState<PerformanceResp | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/equipe/${memberId}/performance?periodo=${periodo}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((j) => !cancelled && setData(j))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [memberId, periodo])

  return (
    <div className="space-y-5">
      <header style={{ paddingTop: 4 }}>
        <Link
          href="/gestao/equipe"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--text-dim)',
            textDecoration: 'none',
            marginBottom: 12,
          }}
        >
          <ArrowLeft className="w-3 h-3" /> Voltar para Equipe
        </Link>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          GESTÃO · PERFORMANCE INDIVIDUAL
        </div>
        <div className="flex items-end justify-between flex-wrap gap-3">
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
              {data?.member.nome ?? memberName}
            </h1>
            <p
              style={{
                marginTop: 4,
                fontSize: 13,
                color: 'var(--text-mute)',
              }}
            >
              {data?.member.cargo ?? 'Sem cargo definido'}
              {data?.member.funcoes && data.member.funcoes.length > 0 && (
                <>
                  {' · '}
                  {data.member.funcoes
                    .map((f) => FUNCAO_LABEL[f as Funcao] ?? f)
                    .join(', ')}
                </>
              )}
            </p>
            {data?.member.areasPermitidas && data.member.areasPermitidas.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {data.member.areasPermitidas.map((a) => (
                  <span
                    key={a}
                    style={{
                      padding: '2px 8px',
                      fontSize: 11,
                      borderRadius: 'var(--r-pill)',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {AREA_LABEL[a as Area] ?? a}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {(['mes', 'trim', 'ano'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodo(p)}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  borderRadius: 'var(--r-pill)',
                  background: periodo === p ? 'var(--accent)' : 'var(--surface-2)',
                  color: periodo === p ? 'var(--accent-ink)' : 'var(--text)',
                  border: `1px solid ${periodo === p ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  fontWeight: periodo === p ? 600 : 400,
                }}
              >
                {PERIODO_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* KPIs */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <Kpi
          icon={<Users className="w-4 h-4" />}
          label="Clientes ativos"
          value={loading ? '…' : String(data?.metricas.clientesAtivos ?? 0)}
        />
        <Kpi
          icon={<Briefcase className="w-4 h-4" />}
          label="Propostas criadas"
          value={loading ? '…' : String(data?.metricas.propostasCriadas ?? 0)}
          sub={
            data ? `Valor total ${brl(data.metricas.valorPropostas)}` : undefined
          }
        />
        <Kpi
          icon={<FileCheck className="w-4 h-4" />}
          label="Contratos fechados"
          value={loading ? '…' : String(data?.metricas.contratosFechados ?? 0)}
          sub={data ? `GMV ${brl(data.metricas.gmv)}` : undefined}
        />
        <Kpi
          icon={<Target className="w-4 h-4" />}
          label="Conversão"
          value={loading ? '…' : pct(data?.metricas.taxaConversao ?? 0)}
          sub="Contratos / propostas"
        />
        <Kpi
          icon={<BarChart3 className="w-4 h-4" />}
          label="Ticket médio"
          value={loading ? '…' : brl(data?.metricas.ticketMedio ?? 0)}
        />
        <Kpi
          icon={<TrendingUp className="w-4 h-4" />}
          label="Valor médio proposta"
          value={
            loading
              ? '…'
              : brl(
                  (data?.metricas.valorPropostas ?? 0) /
                    Math.max(1, data?.metricas.propostasCriadas ?? 0),
                )
          }
        />
      </section>

      <section className="sec-card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Como ler estes números
        </h2>
        <ul
          style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            lineHeight: 1.6,
            paddingLeft: 16,
          }}
        >
          <li>
            <b>Clientes ativos</b> conta os cadastros onde este colaborador é o
            responsável (gerente de conta) no momento.
          </li>
          <li>
            <b>Propostas criadas</b> inclui qualquer proposta no período onde
            ele é vendedor ou gerente da conta.
          </li>
          <li>
            <b>Contratos fechados</b> conta contratos no período cujo vendedor
            ou gerente da conta é ele — independente de quando a proposta
            original foi criada.
          </li>
          <li>
            <b>Conversão</b> e <b>ticket médio</b> são derivados dos dois
            anteriores. Períodos com poucos dados podem distorcer a taxa.
          </li>
        </ul>
      </section>
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="sec-card" style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: 'var(--text-dim)',
          fontFamily: 'var(--f-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 8,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-mute)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}
