'use client'

import Link from 'next/link'

interface PropostaKanban {
  id: string
  numero: string
  status: string
  valorTotal: string // Decimal serializado
  cliente: { id: string; nome: string }
  /** quantidade total em sacas (somatório dos grãos) */
  quantidadeSc?: number | null
  /** commodity dominante (1º grão do array) */
  commodity?: string | null
  /** score interno (se houver) */
  scoreInterno?: number | null
}

interface Column {
  key: string
  label: string
  /** Status que caem nesta coluna. */
  matchStatus: (s: string) => boolean
  /** Cor do dot/header. */
  accent: string
}

const COLUMNS: Column[] = [
  {
    key: 'rascunho',
    label: 'Rascunho',
    matchStatus: (s) => /rascunho|pendente|pronta/.test(s),
    accent: 'var(--text-mute)',
  },
  {
    key: 'enviada',
    label: 'Enviada',
    matchStatus: (s) => /^enviada$/.test(s),
    accent: '#7FA8FF',
  },
  {
    key: 'em_negociacao',
    label: 'Em negociação',
    matchStatus: (s) => /negocia/.test(s),
    accent: '#F5A86B',
  },
  {
    key: 'sucesso',
    label: 'Sucesso',
    matchStatus: (s) => /sucesso|aceita|aprovada|concluido|faturado/.test(s),
    accent: 'var(--success)',
  },
  {
    key: 'recusada',
    label: 'Recusada',
    matchStatus: (s) => /recusada|rejeitada|expirada|cancelad/.test(s),
    accent: 'var(--danger)',
  },
]

function avatarColor(nome: string): { bg: string; fg: string } {
  const palette = [
    { bg: '#A8C5FF', fg: '#0A1A3D' },
    { bg: '#C8F051', fg: '#0A0B0E' },
    { bg: '#F5A86B', fg: '#3A1A00' },
    { bg: '#B98AF5', fg: '#1F0A3D' },
    { bg: '#7FA8FF', fg: '#0A1530' },
    { bg: '#79E0AB', fg: '#0A2A1A' },
    { bg: '#F47B7B', fg: '#3A0A0A' },
  ]
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0
  return palette[h % palette.length]!
}

function initials(nome: string): string {
  const parts = nome
    .replace(/[^\p{L}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function fmtCompactBRL(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace('.', ',')}M`
  if (abs >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

interface Props {
  propostas: PropostaKanban[]
}

export function PropostasKanban({ propostas }: Props) {
  // Distribuir propostas em colunas
  const byColumn = COLUMNS.map((col) => {
    const items = propostas.filter((p) => col.matchStatus(p.status.toLowerCase()))
    return { col, items }
  })

  return (
    <div
      className="overflow-x-auto"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(220px, 1fr))`,
        gap: 16,
        paddingBottom: 8,
      }}
    >
      {byColumn.map(({ col, items }) => (
        <div
          key={col.key}
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            padding: 14,
            minHeight: 320,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* Header da coluna */}
          <div className="flex items-center justify-between">
            <div className="eyebrow" style={{ color: col.accent }}>
              {col.label}
            </div>
            <span
              className="tabular-nums"
              style={{
                fontSize: 12,
                color: 'var(--text-dim)',
                fontFamily: 'var(--f-mono)',
              }}
            >
              {items.length}
            </span>
          </div>

          {/* Cards */}
          {items.length === 0 ? (
            <div
              className="text-center"
              style={{
                fontSize: 12,
                color: 'var(--text-dim)',
                padding: '40px 12px',
              }}
            >
              vazio
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((p) => {
                const valor = Number(p.valorTotal) || 0
                const color = avatarColor(p.cliente.nome)
                return (
                  <Link
                    key={p.id}
                    href={`/propostas/${p.id}`}
                    style={{
                      display: 'block',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-md)',
                      padding: 12,
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'all 120ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = col.accent
                      e.currentTarget.style.background = 'var(--surface-3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.background = 'var(--surface-2)'
                    }}
                  >
                    {/* Cabeçalho — avatar + nome */}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          background: color.bg,
                          color: color.fg,
                          fontFamily: 'var(--f-mono)',
                          fontWeight: 700,
                          fontSize: 10,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {initials(p.cliente.nome)}
                      </div>
                      <div
                        className="truncate"
                        style={{ fontSize: 13, fontWeight: 500 }}
                      >
                        {p.cliente.nome}
                      </div>
                    </div>

                    {/* Valor — destaque */}
                    <div
                      className="tabular-nums"
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        letterSpacing: '-0.02em',
                        color: 'var(--text)',
                        marginBottom: 4,
                      }}
                    >
                      {fmtCompactBRL(valor)}
                    </div>

                    {/* Meta: qtd · commodity */}
                    {(p.quantidadeSc != null || p.commodity) && (
                      <div
                        style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}
                      >
                        {p.quantidadeSc != null
                          ? `${p.quantidadeSc.toLocaleString('pt-BR')} sc`
                          : ''}
                        {p.quantidadeSc != null && p.commodity ? ' · ' : ''}
                        {p.commodity ?? ''}
                      </div>
                    )}

                    {/* Score chip (se houver) */}
                    {p.scoreInterno != null && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: 'rgba(127, 168, 255, 0.12)',
                          color: '#A8C5FF',
                          border: '1px solid rgba(127, 168, 255, 0.25)',
                          fontSize: 10,
                          fontWeight: 500,
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 999,
                            background: '#7FA8FF',
                          }}
                        />
                        Score {p.scoreInterno}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
