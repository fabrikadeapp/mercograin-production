import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { BhGrainShell } from '@/app/bhgrain/_components/BhGrainShell'
import { Mail, User, Building, Calendar, Shield, ArrowRight } from 'lucide-react'
import { getScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const scope = await getScope()
  if (!scope) redirect('/auth/login')

  const [user, workspace, membership] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        emailVerificado: true,
        totpEnabled: true,
        criadoEm: true,
      },
    }),
    db.workspace.findUnique({
      where: { id: scope.workspaceId },
      select: { name: true, codigo: true },
    }),
    db.workspaceMember.findFirst({
      where: { workspaceId: scope.workspaceId, userId: session.user.id },
      select: { role: true, cargo: true, funcoes: true, areasPermitidas: true },
    }),
  ])

  if (!user) redirect('/auth/login')

  return (
    <BhGrainShell
      userName={user.nome ?? user.email}
      workspaceName={workspace?.name ?? null}
      userEmail={user.email}
      userRole={user.role}
      workspaceRole={membership?.role ?? null}
      areasPermitidas={membership?.areasPermitidas ?? null}
    >
      <div className="space-y-4">
        <header style={{ paddingTop: 4 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            GESTÃO · MEU PERFIL
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {user.nome ?? user.email}
          </h1>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-mute)' }}>
            Suas informações de conta e segurança.
          </p>
        </header>

        <section
          className="sec-card"
          style={{ padding: 20, display: 'grid', gap: 12 }}
        >
          <Row icon={<User className="w-3.5 h-3.5" />} label="Nome" value={user.nome ?? '—'} />
          <Row icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={user.email} />
          <Row
            icon={<Building className="w-3.5 h-3.5" />}
            label="Workspace ativo"
            value={`${workspace?.name ?? '—'} (${workspace?.codigo ?? '—'})`}
          />
          <Row
            icon={<Shield className="w-3.5 h-3.5" />}
            label="Cargo"
            value={membership?.cargo ?? '—'}
          />
          <Row
            icon={<Calendar className="w-3.5 h-3.5" />}
            label="Membro desde"
            value={user.criadoEm.toLocaleDateString('pt-BR')}
          />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActionCard
            title="Segurança da conta"
            description="Verificação em duas etapas, senha, sessões ativas."
            href="/perfil/seguranca/2fa"
          />
          <ActionCard
            title="Minha assinatura"
            description="Plano, faturas, cancelamento."
            href="/assinatura"
          />
        </section>
      </div>
    </BhGrainShell>
  )
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div
        className="flex items-center gap-2"
        style={{ color: 'var(--text-dim)', fontSize: 12 }}
      >
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

function ActionCard({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="sec-card"
      style={{
        padding: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        textDecoration: 'none',
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {title}
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-mute)' }}>
          {description}
        </div>
      </div>
      <ArrowRight className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
    </Link>
  )
}
