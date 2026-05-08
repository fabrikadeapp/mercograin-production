import { NextResponse } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'
import { syncWorkspaceSeats } from '@/lib/stripe/seats'

export const dynamic = 'force-dynamic'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
})

function canManageMembers(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

export async function GET() {
  try {
    const scope = await requireScope()
    const members = await db.workspaceMember.findMany({
      where: { workspaceId: scope.workspaceId },
      include: {
        user: { select: { id: true, nome: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ members })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'unauthorized' },
      { status: 401 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const scope = await requireScope()
    if (!canManageMembers(scope.workspaceRole)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const parsed = inviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'invalid' },
        { status: 400 }
      )
    }
    const { email, role } = parsed.data

    // Existe membership desse email?
    const existing = await db.workspaceMember.findUnique({
      where: { workspaceId_email: { workspaceId: scope.workspaceId, email } },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'already_member', member: existing },
        { status: 409 }
      )
    }

    // Vincula a User existente se houver
    const user = await db.user.findUnique({ where: { email } })

    const inviteToken = randomBytes(24).toString('hex')

    const member = await db.workspaceMember.create({
      data: {
        workspaceId: scope.workspaceId,
        email,
        role,
        userId: user?.id ?? null,
        status: user ? 'active' : 'invited',
        inviteToken: user ? null : inviteToken,
        invitedAt: new Date(),
        acceptedAt: user ? new Date() : null,
      },
    })

    // Cobra seats apenas membros ativos (não pendentes)
    let seatInfo: any = null
    try {
      seatInfo = await syncWorkspaceSeats(scope.workspaceId)
    } catch (err) {
      console.warn('[workspace/members POST] seat sync falhou:', err)
    }

    // TODO: enviar email de convite quando status='invited'
    return NextResponse.json({ member, seats: seatInfo })
  } catch (e: any) {
    console.error('[workspace/members POST]', e)
    return NextResponse.json(
      { error: e?.message || 'error' },
      { status: 500 }
    )
  }
}
