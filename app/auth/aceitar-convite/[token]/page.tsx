import { db } from '@/lib/db'
import { AcceptInviteForm } from './_components/AcceptInviteForm'

export const dynamic = 'force-dynamic'

export default async function AceitarConvitePage({
  params,
}: {
  params: { token: string }
}) {
  const member = await db.workspaceMember.findFirst({
    where: { inviteToken: params.token },
    include: {
      workspace: { select: { name: true } },
    },
  })

  const status: 'invalido' | 'expirado' | 'aceito' | 'pendente' = !member
    ? 'invalido'
    : member.status !== 'invited'
      ? 'aceito'
      : member.invitedAt &&
          Date.now() >
            new Date(member.invitedAt).getTime() + 14 * 24 * 3600 * 1000
        ? 'expirado'
        : 'pendente'

  const userExistente = member
    ? await db.user.findUnique({ where: { email: member.email }, select: { id: true } })
    : null

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 32,
        }}
      >
        {status === 'invalido' && (
          <Mensagem
            titulo="Convite inválido"
            corpo="O link que você acessou não é válido. Peça ao administrador para reenviar o convite."
          />
        )}
        {status === 'expirado' && (
          <Mensagem
            titulo="Convite expirado"
            corpo="Este convite passou de 14 dias. Peça um novo convite ao administrador do workspace."
          />
        )}
        {status === 'aceito' && (
          <Mensagem
            titulo="Convite já utilizado"
            corpo="Este convite já foi aceito. Faça login normalmente."
            ctaLabel="Ir para login"
            ctaHref="/auth/login"
          />
        )}
        {status === 'pendente' && member && (
          <AcceptInviteForm
            token={params.token}
            email={member.email}
            workspaceName={member.workspace.name}
            cargo={member.cargo}
            userJaExiste={!!userExistente}
          />
        )}
      </div>
    </div>
  )
}

function Mensagem({
  titulo,
  corpo,
  ctaLabel,
  ctaHref,
}: {
  titulo: string
  corpo: string
  ctaLabel?: string
  ctaHref?: string
}) {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{titulo}</h1>
      <p style={{ marginTop: 12, fontSize: 14, color: 'var(--text-mute)' }}>
        {corpo}
      </p>
      {ctaLabel && ctaHref && (
        <a
          href={ctaHref}
          style={{
            display: 'inline-block',
            marginTop: 20,
            padding: '10px 16px',
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {ctaLabel}
        </a>
      )}
    </div>
  )
}
