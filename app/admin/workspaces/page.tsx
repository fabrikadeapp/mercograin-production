import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function WorkspacesAdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const u = session.user as any
  if (u.role !== 'admin') redirect('/dashboard')

  const workspaces = await db.workspace.findMany({
    include: {
      owner: { select: { nome: true, email: true } },
      _count: {
        select: { members: true, propostas: true, contratos: true, features: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-6">
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--f-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-dim)',
            marginBottom: 6,
          }}
        >
          SUPER-ADMIN · WORKSPACES
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Workspaces ({workspaces.length})
        </h1>
        <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-mute)' }}>
          Gerencie códigos e feature flags por workspace.
        </p>
      </header>

      <section className="sec-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <Th>Workspace</Th>
              <Th>Código</Th>
              <Th>Owner</Th>
              <Th align="right">Members</Th>
              <Th align="right">Propostas</Th>
              <Th align="right">Contratos</Th>
              <Th align="right">Features ON</Th>
              <Th align="right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map((w) => (
              <tr key={w.id} style={{ borderTop: '1px solid var(--border)' }}>
                <Td>
                  <div style={{ fontWeight: 500 }}>{w.name}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-dim)',
                      fontFamily: 'var(--f-mono)',
                    }}
                  >
                    {w.id.slice(0, 12)}…
                  </div>
                </Td>
                <Td>
                  <code style={{ fontFamily: 'var(--f-mono)', fontSize: 12 }}>
                    {w.codigo ?? '—'}
                  </code>
                </Td>
                <Td>
                  <div style={{ fontSize: 12 }}>{w.owner?.nome ?? '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {w.owner?.email}
                  </div>
                </Td>
                <Td align="right">{w._count.members}</Td>
                <Td align="right">{w._count.propostas}</Td>
                <Td align="right">{w._count.contratos}</Td>
                <Td align="right">{w._count.features}</Td>
                <Td align="right">
                  <Link
                    href={`/admin/workspaces/${w.id}/features`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      color: 'var(--accent)',
                      textDecoration: 'none',
                    }}
                  >
                    Features <ArrowRight className="w-3 h-3" />
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      style={{
        textAlign: align ?? 'left',
        padding: '10px 14px',
        fontSize: 11,
        fontFamily: 'var(--f-mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-dim)',
        fontWeight: 500,
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <td
      style={{
        textAlign: align ?? 'left',
        padding: '10px 14px',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  )
}
