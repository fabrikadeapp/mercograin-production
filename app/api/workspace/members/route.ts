import { NextResponse } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'
import { syncWorkspaceSeats } from '@/lib/stripe/seats'
import { sendEmail } from '@/lib/email/send'
import { memberInviteTemplate } from '@/lib/email/templates/member-invite'

export const dynamic = 'force-dynamic'

const AREA_VALUES = ['mesa', 'financeiro', 'fiscal', 'gestao'] as const
const FUNCAO_VALUES = [
  'trader',
  'gerente_mesa',
  'gerente_conta',
  'cs',
  'analista_financeiro',
  'gerente_administrativo',
  'cfo',
  'analista_fiscal',
  'gerente_fiscal',
  'assistente',
  'compliance',
  'ti',
] as const

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  cargo: z.string().trim().max(120).optional().nullable(),
  areasPermitidas: z.array(z.enum(AREA_VALUES)).optional().default([]),
  funcoes: z.array(z.enum(FUNCAO_VALUES)).optional().default([]),
})

function canManageMembers(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

export async function GET() {
  try {
    const scope = await requireScope()
    const members = await db.workspaceMember.findMany({
      where: { workspaceId: scope.workspaceId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        cargo: true,
        areasPermitidas: true,
        invitedAt: true,
        acceptedAt: true,
        createdAt: true,
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
  let scope
  try {
    scope = await requireScope()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
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
    const { email, role, cargo, areasPermitidas, funcoes } = parsed.data

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
        cargo: cargo || null,
        areasPermitidas,
        funcoes,
      },
    })

    // Cobra seats apenas membros ativos (não pendentes)
    let seatInfo: any = null
    try {
      seatInfo = await syncWorkspaceSeats(scope.workspaceId)
    } catch (err) {
      console.warn('[workspace/members POST] seat sync falhou:', err)
    }

    // Envia email de convite (status='invited') ou notificação de acesso (status='active')
    try {
      const [inviter, workspace] = await Promise.all([
        db.user.findUnique({
          where: { id: scope.userId },
          select: { nome: true, email: true },
        }),
        db.workspace.findUnique({
          where: { id: scope.workspaceId },
          select: { name: true },
        }),
      ])
      const inviterName = inviter?.nome ?? inviter?.email ?? 'Administrador'
      const workspaceName = workspace?.name ?? 'BH Grain'

      // Áreas mostradas no email: admin vê todas, demais só as marcadas.
      const areasParaEmail =
        role === 'admin' ? ['mesa', 'financeiro', 'fiscal', 'gestao'] : areasPermitidas

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXTAUTH_URL ||
        'https://www.profitsync.ia.br'
      const acceptUrl = member.inviteToken
        ? `${baseUrl}/auth/aceitar-convite/${member.inviteToken}`
        : `${baseUrl}/dashboard`

      const tpl = memberInviteTemplate({
        invitedEmail: email,
        inviterName,
        workspaceName,
        cargo,
        areas: areasParaEmail,
        acceptUrl,
      })
      await sendEmail({
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        tags: [{ name: 'type', value: 'member-invite' }],
      })
    } catch (err) {
      console.warn('[workspace/members POST] envio de email falhou:', err)
    }

    return NextResponse.json({ member, seats: seatInfo })
  } catch (e: any) {
    console.error('[workspace/members POST]', e)
    return NextResponse.json(
      { error: e?.message || 'error' },
      { status: 500 }
    )
  }
}
