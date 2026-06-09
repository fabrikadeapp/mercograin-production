import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'
import { invalidateWorkspaceTheme } from '@/lib/ui/workspace-theme'
import {
  DESIGN_SYSTEMS,
  isValidDesignSystem,
} from '@/lib/ui/design-systems'

export const dynamic = 'force-dynamic'

const slugs = DESIGN_SYSTEMS.map((d) => d.slug) as [string, ...string[]]
const schema = z.object({
  designSystem: z.enum(slugs),
})

/**
 * GET /api/workspace/tema
 * Retorna o design system atual do workspace.
 */
export async function GET() {
  let scope
  try {
    scope = await requireScope()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const ws = await db.workspace.findUnique({
    where: { id: scope.workspaceId },
    select: { id: true, designSystem: true },
  })
  return NextResponse.json({ designSystem: ws?.designSystem ?? 'lime' })
}

/**
 * PATCH /api/workspace/tema
 * Define o design system (tema visual) da corretora. Vale para TODOS os
 * usuários do workspace. Gate: owner/admin.
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
  if (!parsed.success || !isValidDesignSystem(parsed.data.designSystem)) {
    return NextResponse.json(
      { error: 'Tema inválido' },
      { status: 400 },
    )
  }

  const updated = await db.workspace.update({
    where: { id: scope.workspaceId },
    data: { designSystem: parsed.data.designSystem },
    select: { id: true, designSystem: true },
  })

  // Invalida o cache SSR para o próximo render já aplicar o tema novo.
  invalidateWorkspaceTheme(scope.workspaceId)

  return NextResponse.json({ ok: true, workspace: updated })
}
