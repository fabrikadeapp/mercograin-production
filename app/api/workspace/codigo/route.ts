import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

const schema = z.object({
  codigo: z
    .string()
    .min(2)
    .max(8)
    .regex(/^[A-Z0-9]+$/, 'Apenas letras maiúsculas e números'),
})

/**
 * PATCH /api/workspace/codigo
 * Atualiza o código do workspace (prefixo de numeração de propostas/contratos).
 * Gate: owner/admin.
 */
export async function PATCH(req: NextRequest) {
  let scope
  try {
    scope = await requireScope()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (
    !scope.isAdmin &&
    scope.workspaceRole !== 'owner' &&
    scope.workspaceRole !== 'admin'
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'invalid' },
      { status: 400 },
    )
  }

  const updated = await db.workspace.update({
    where: { id: scope.workspaceId },
    data: { codigo: parsed.data.codigo.toUpperCase() },
    select: { id: true, codigo: true },
  })

  return NextResponse.json({ ok: true, workspace: updated })
}

export async function GET() {
  let scope
  try {
    scope = await requireScope()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const ws = await db.workspace.findUnique({
    where: { id: scope.workspaceId },
    select: { id: true, codigo: true, name: true },
  })
  return NextResponse.json({ workspace: ws })
}
