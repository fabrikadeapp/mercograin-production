import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { BhGrainShell } from '@/app/bhgrain/_components/BhGrainShell'
import { isFeatureEnabled } from '@/lib/features'

export const dynamic = 'force-dynamic'

export default async function LauraPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')
  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const featureOn = await isFeatureEnabled(scope.workspaceId, 'laura_ai')

  const [user, workspace, membership, conversas, propostasIA] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { nome: true, email: true, role: true },
    }),
    db.workspace.findUnique({
      where: { id: scope.workspaceId },
      select: { name: true },
    }),
    db.workspaceMember.findFirst({
      where: { workspaceId: scope.workspaceId, userId: session.user.id },
      select: { role: true, areasPermitidas: true },
    }),
    db.lauraConversation
      .findMany({
        where: { workspaceId: scope.workspaceId },
        orderBy: { ultimaMensagemEm: 'desc' },
        take: 20,
        include: {
          cliente: { select: { nome: true } },
          _count: { select: { messages: true } },
        },
      })
      .catch(() => []),
    db.proposta
      .count({
        where: {
          workspaceId: scope.workspaceId,
          canalAutorizacao: { in: ['whatsapp', 'telefone', 'ia_autonomo'] },
        },
      })
      .catch(() => 0),
  ])

  const totalMensagens = await db.lauraMessage
    .count({
      where: {
        conversation: { workspaceId: scope.workspaceId },
      },
    })
    .catch(() => 0)

  const conversasAguardando = conversas.filter(
    (c) => c.status === 'aguardando_humano',
  ).length

  return (
    <BhGrainShell
      userName={user?.nome ?? user?.email ?? null}
      workspaceName={workspace?.name ?? null}
      userEmail={user?.email ?? null}
      userRole={user?.role ?? null}
      workspaceRole={membership?.role ?? null}
      areasPermitidas={membership?.areasPermitidas ?? null}
    >
      <div className="space-y-4">
        <header style={{ paddingTop: 4 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            MESA · LAURA.IA
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1
              style={{
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              Laura.IA
            </h1>
            <span
              style={{
                fontSize: 12,
                padding: '2px 10px',
                borderRadius: 999,
                background: featureOn ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: featureOn ? 'var(--accent)' : 'var(--text-dim)',
                fontWeight: 600,
              }}
            >
              {featureOn ? '● Ativa' : '○ Desligada'}
            </span>
          </div>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-mute)', maxWidth: 640 }}>
            Agente conversacional que atende clientes via WhatsApp/Telefone,
            classifica intenções e gera propostas pré-formadas para você
            autorizar com 1 click.
          </p>
        </header>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          <Kpi label="Conversas (últ. 20)" value={String(conversas.length)} />
          <Kpi
            label="Aguardando humano"
            value={String(conversasAguardando)}
            highlight={conversasAguardando > 0}
          />
          <Kpi label="Mensagens totais" value={String(totalMensagens)} />
          <Kpi label="Propostas via IA" value={String(propostasIA)} />
        </section>

        {!featureOn && (
          <div
            className="sec-card"
            style={{
              padding: 16,
              background: 'var(--warning-soft, rgba(255,180,0,0.06))',
              borderLeft: '3px solid var(--warning)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Laura.IA está desativada para este workspace
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-mute)' }}>
              Mensagens ainda são registradas, mas não há classificação automática
              nem criação de propostas. Para ativar, vá em <b>Super-admin →
              Workspaces → {workspace?.name} → Features</b>.
            </div>
          </div>
        )}

        <section className="sec-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <Th>Cliente</Th>
                <Th>Canal · Handle</Th>
                <Th>Status</Th>
                <Th>Intent</Th>
                <Th align="right">Msgs</Th>
                <Th>Última msg</Th>
              </tr>
            </thead>
            <tbody>
              {conversas.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: 32,
                      textAlign: 'center',
                      color: 'var(--text-dim)',
                    }}
                  >
                    Nenhuma conversa registrada ainda.
                  </td>
                </tr>
              )}
              {conversas.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <Td>
                    {c.cliente?.nome ?? (
                      <span style={{ color: 'var(--text-dim)' }}>
                        Não identificado
                      </span>
                    )}
                  </Td>
                  <Td>
                    <code style={{ fontSize: 11, fontFamily: 'var(--f-mono)' }}>
                      {c.canal} · {c.handle}
                    </code>
                  </Td>
                  <Td>
                    <StatusPill status={c.status} />
                  </Td>
                  <Td>
                    {c.intentDetectado ? (
                      <code style={{ fontSize: 11, fontFamily: 'var(--f-mono)' }}>
                        {c.intentDetectado}
                      </code>
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>—</span>
                    )}
                  </Td>
                  <Td align="right">{c._count.messages}</Td>
                  <Td>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {c.ultimaMensagemEm
                        ? new Date(c.ultimaMensagemEm).toLocaleString('pt-BR')
                        : '—'}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </BhGrainShell>
  )
}

function Kpi({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className="sec-card"
      style={{
        padding: 16,
        borderLeft: highlight ? '3px solid var(--accent)' : undefined,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          fontFamily: 'var(--f-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}
      >
        {value}
      </div>
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

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    aberta: { label: 'Aberta', color: 'var(--info)' },
    aguardando_humano: { label: 'Aguardando você', color: 'var(--warning)' },
    resolvida: { label: 'Resolvida', color: 'var(--success)' },
    descartada: { label: 'Descartada', color: 'var(--text-dim)' },
  }
  const c = config[status] ?? { label: status, color: 'var(--text-dim)' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        fontSize: 11,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: c.color,
        }}
      />
      {c.label}
    </span>
  )
}
