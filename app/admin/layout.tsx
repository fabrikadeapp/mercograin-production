import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { headers } from 'next/headers'
import { AdminShell } from './_components/AdminShell'

export const dynamic = 'force-dynamic'

/**
 * Super-admin Mercograin — guard estanque (defense in depth).
 *
 * Camada 1 (middleware.ts): exige role='admin' + sem workspace + 2FA.
 * Camada 2 (este layout):    re-verifica no DB e grava audit log.
 *
 * Falhar qualquer regra → redirect /dashboard (não 403, pra não revelar
 * existência da rota).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const u = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      nome: true,
      email: true,
      totpEnabled: true,
      workspaceMemberships: { select: { id: true }, take: 1 },
    },
  })

  // Regra 1: role='admin' global
  if (!u || u.role !== 'admin') redirect('/dashboard')

  // Regra 2: NÃO pode ter WorkspaceMember (super-admin puro)
  if (u.workspaceMemberships.length > 0) redirect('/dashboard')

  // Regra 3: 2FA TOTP obrigatório
  if (!u.totpEnabled) redirect('/perfil/seguranca/2fa?motivo=super_admin_exige_2fa')

  // Audit log do acesso
  try {
    const h = headers()
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      'unknown'
    const ua = h.get('user-agent') || 'unknown'
    await db.auditLog.create({
      data: {
        userId: u.id,
        acao: 'super_admin_access',
        entidade: 'admin_panel',
        entidadeId: u.id,
        ipAddress: ip,
        userAgent: ua,
      },
    })
  } catch {
    // não bloqueia acesso se audit falhar
  }

  return (
    <AdminShell user={{ nome: u.nome, email: u.email }}>{children}</AdminShell>
  )
}
