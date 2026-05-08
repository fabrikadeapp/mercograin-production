import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * Impersonate — gera token temporário para acessar a conta como o usuário.
 *
 * Implementação simplificada (sem JWT custom): cria um EmailVerificationToken
 * descartável (1h) e retorna URL com query param. O endpoint /api/admin/impersonate-callback
 * consumiria esse token para criar uma sessão.
 *
 * **Desabilitado por padrão** — somente ativa com ENABLE_IMPERSONATE=true.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (process.env.ENABLE_IMPERSONATE !== 'true') {
      return NextResponse.json(
        { error: 'impersonate_disabled' },
        { status: 403 },
      )
    }
    const admin = await requireAdmin()
    const target = await db.user.findUnique({ where: { id: params.id } })
    if (!target) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const token = `imp_${admin.id}_${target.id}_${Date.now().toString(36)}`
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await db.emailVerificationToken.create({
      data: { userId: target.id, token, expiresAt },
    })

    await db.auditLog.create({
      data: {
        userId: admin.id,
        acao: 'admin_impersonate',
        entidade: 'user',
        entidadeId: target.id,
        mudancas: { tokenIssued: true, expiresAt: expiresAt.toISOString() },
      },
    })

    const url = `/api/admin/impersonate/callback?token=${token}`
    return NextResponse.json({ ok: true, url, expiresAt })
  } catch (e) {
    return adminErrorResponse(e)
  }
}
