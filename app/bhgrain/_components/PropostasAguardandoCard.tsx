'use client'

import Link from 'next/link'
import {
  ArrowUpRight,
  FileText,
  Bot,
  MessageCircle,
  Phone,
} from 'lucide-react'
import {
  GlassCard,
  Skeleton,
  ErrorState,
  EmptyState,
  fmtBRL,
  useJson,
} from './_shared'
import { useDashboardFilters } from './DashboardFiltersContext'

interface Aguardando {
  id: string
  numero: string
  clienteNome: string
  valorTotal: number
  status: 'rascunho' | 'aguardando_autorizacao'
  canalAutorizacao: 'web' | 'whatsapp' | 'telefone' | 'ia_autonomo' | null
  criadaEm: string
}

interface Resp {
  items: Aguardando[]
  count: number
}

function iniciais(nome: string | null | undefined): string {
  if (!nome) return '—'
  return (
    nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '—'
  )
}

function ageLabel(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}m`
  if (min < 60 * 24) return `${Math.floor(min / 60)}h`
  return `${Math.floor(min / 60 / 24)}d`
}

const CANAL_ICON = {
  whatsapp: MessageCircle,
  telefone: Phone,
  ia_autonomo: Bot,
  web: FileText,
} as const

export function PropostasAguardandoCard({
  onOpenProposta,
}: {
  onOpenProposta: (id: string) => void
}) {
  const filtros = useDashboardFilters()
  const { data, error, loading } = useJson<Resp>(
    `/api/bhgrain/propostas-aguardando${filtros.qs}`,
    [filtros.params],
    { pollMs: 30_000 },
  )

  const rows = data?.items ?? []
  const count = data?.count ?? rows.length

  return (
    <GlassCard
      title="Aguardando envio"
      subtitle={`Rascunhos & pendências (${count})`}
      action={
        <Link
          href="/aprovacoes/propostas"
          className="text-[11px] text-vg-fg-3 hover:text-vg-fg-primary flex items-center gap-1"
        >
          Ver tudo <ArrowUpRight className="w-3 h-3" />
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Erro ao carregar" />
      ) : rows.length === 0 ? (
        <EmptyState message="Nada aguardando envio" />
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 6).map((p) => {
            const isLaura = p.status === 'aguardando_autorizacao'
            const Icon =
              CANAL_ICON[p.canalAutorizacao ?? 'web'] ?? FileText
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onOpenProposta(p.id)}
                  className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-md transition"
                  style={{
                    background: 'transparent',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--tint-4pct)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: isLaura
                        ? 'var(--accent-soft)'
                        : 'var(--surface-2)',
                      color: isLaura ? 'var(--accent)' : 'var(--text)',
                      fontSize: 10,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {iniciais(p.clienteNome)}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.clienteNome}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 1,
                      }}
                    >
                      <Icon style={{ width: 9, height: 9 }} />
                      {isLaura ? 'Aguardando autorização' : 'Rascunho'}
                      <span style={{ color: 'var(--border)' }}>·</span>
                      <span>{ageLabel(p.criadaEm)}</span>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--f-mono)',
                      color: 'var(--text)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fmtBRL(p.valorTotal)}
                  </span>
                </button>
              </li>
            )
          })}
          {rows.length > 6 && (
            <li
              style={{
                paddingTop: 4,
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--text-dim)',
              }}
            >
              + {rows.length - 6} outras
            </li>
          )}
        </ul>
      )}
    </GlassCard>
  )
}
