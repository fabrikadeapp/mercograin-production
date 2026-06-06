import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getPortalSession } from '@/lib/portal-produtor/auth'

export default async function ContratosPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const sess = await getPortalSession()
  if (!sess) redirect(`/portal/${params.workspaceSlug}/login`)
  const contratos = await db.contrato.findMany({
    where: { clienteId: sess.clienteId, workspaceId: sess.workspaceId },
    orderBy: { criadoEm: 'desc' },
    include: { proposta: { select: { valorTotal: true, tipo: true } } },
  })
  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16, color: 'var(--portal-ink)' }}>
        Meus contratos
      </h1>
      <div className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 14, color: 'var(--portal-ink)', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--portal-surface-2)' }}>
            <tr style={{ textAlign: 'left' }}>
              <th style={th}>Número</th>
              <th style={th}>Tipo</th>
              <th style={th}>Status</th>
              <th style={th}>Valor</th>
              <th style={th}>Criado em</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {contratos.map((c) => (
              <tr key={c.id} style={{ borderTop: '1px solid var(--portal-border)' }}>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{c.numero}</td>
                <td style={tdMute}>{c.proposta?.tipo ?? '—'}</td>
                <td style={td}>
                  <StatusBadge status={c.statusAssinatura} />
                </td>
                <td style={{ ...td, fontWeight: 600 }}>{fmt(Number(c.proposta?.valorTotal ?? 0))}</td>
                <td style={tdMute}>{new Date(c.criadoEm).toLocaleDateString('pt-BR')}</td>
                <td style={td}>
                  <Link
                    href={`/portal/${params.workspaceSlug}/contratos/${c.id}`}
                    style={{
                      color: 'var(--portal-accent)',
                      textDecoration: 'underline',
                      fontWeight: 500,
                    }}
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {contratos.length === 0 && (
              <tr>
                <td colSpan={6} className="portal-empty">
                  Sem contratos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    pendente: { bg: 'var(--portal-warn-soft)', fg: 'var(--portal-warn)', label: 'Aguardando envio' },
    enviada: { bg: 'var(--portal-info-soft)', fg: 'var(--portal-info)', label: 'Aguardando assinatura' },
    assinado: { bg: 'var(--portal-accent-soft)', fg: 'var(--portal-accent-deep)', label: 'Assinado' },
    cancelado: { bg: 'var(--portal-surface-2)', fg: 'var(--portal-ink-mute)', label: 'Cancelado' },
  }
  const v = map[status ?? 'pendente'] ?? map.pendente
  return (
    <span
      style={{
        background: v.bg,
        color: v.fg,
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {v.label}
    </span>
  )
}

const th: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--portal-ink-mute)',
  fontWeight: 600,
}
const td: React.CSSProperties = { padding: '12px 14px', color: 'var(--portal-ink)' }
const tdMute: React.CSSProperties = { padding: '12px 14px', color: 'var(--portal-ink-dim)' }
