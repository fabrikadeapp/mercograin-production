import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'
import { syncWorkspaceSeats } from '@/lib/stripe/seats'

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

const patchSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'viewer']).optional(),
  status: z.enum(['active', 'invited', 'suspended']).optional(),
  cargo: z.string().trim().max(120).optional().nullable(),
  areasPermitidas: z.array(z.enum(AREA_VALUES)).optional(),
  funcoes: z.array(z.enum(FUNCAO_VALUES)).optional(),
})

function canManage(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

async function loadMember(workspaceId: string, id: string) {
  const m = await db.workspaceMember.findFirst({
    where: { id, workspaceId },
  })
  return m
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await requireScope()
    if (!canManage(scope.workspaceRole)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const member = await loadMember(scope.workspaceId, params.id)
    if (!member) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    if (member.role === 'owner') {
      return NextResponse.json(
        { error: 'cannot_modify_owner' },
        { status: 400 }
      )
    }
    const body = await req.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'invalid' },
        { status: 400 }
      )
    }
    const updated = await db.workspaceMember.update({
      where: { id: member.id },
      data: parsed.data,
    })
    let seatInfo: any = null
    try {
      seatInfo = await syncWorkspaceSeats(scope.workspaceId)
    } catch (err) {
      console.warn('[workspace/members PATCH] seat sync falhou:', err)
    }
    return NextResponse.json({ member: updated, seats: seatInfo })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await requireScope()
    if (!canManage(scope.workspaceRole)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const member = await loadMember(scope.workspaceId, params.id)
    if (!member) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    if (member.role === 'owner') {
      return NextResponse.json(
        { error: 'cannot_remove_owner' },
        { status: 400 }
      )
    }
    await db.workspaceMember.delete({ where: { id: member.id } })
    let seatInfo: any = null
    try {
      seatInfo = await syncWorkspaceSeats(scope.workspaceId)
    } catch (err) {
      console.warn('[workspace/members DELETE] seat sync falhou:', err)
    }
    return NextResponse.json({ ok: true, seats: seatInfo })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'error' },
      { status: 500 }
    )
  }
}
