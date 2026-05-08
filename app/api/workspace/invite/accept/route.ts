import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { syncWorkspaceSeats } from '@/lib/stripe/seats'

export const dynamic = 'force-dynamic'

/**
 * Aceita convite via token. Requer login (user.email deve bater com invite.email).
 * Caso o user não exista, retornamos 401 — o frontend deve redirecionar para signup
 * preservando o token e re-chamar este endpoint após criar conta.
 */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'token_missing' }, { status: 400 })
  }

  const member = await db.workspaceMember.findUnique({
    where: { inviteToken: token },
  })
  if (!member) {
    return NextResponse.json({ error: 'invite_not_found' }, { status: 404 })
  }
  if (member.status !== 'invited') {
    return NextResponse.json(
      { error: 'invite_already_handled' },
      { status: 409 }
    )
  }

  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json(
      { error: 'login_required', email: member.email },
      { status: 401 }
    )
  }

  if (
    session.user.email.toLowerCase() !== member.email.toLowerCase()
  ) {
    return NextResponse.json(
      { error: 'email_mismatch', expected: member.email },
      { status: 403 }
    )
  }

  const updated = await db.workspaceMember.update({
    where: { id: member.id },
    data: {
      userId: session.user.id,
      status: 'active',
      inviteToken: null,
      acceptedAt: new Date(),
    },
  })

  try {
    await syncWorkspaceSeats(member.workspaceId)
  } catch (err) {
    console.warn('[invite/accept] seat sync falhou:', err)
  }

  return NextResponse.json({ ok: true, member: updated })
}
