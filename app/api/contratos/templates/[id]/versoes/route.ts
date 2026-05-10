/**
 * GET  /api/contratos/templates/[id]/versoes  — lista versões do template
 * POST /api/contratos/templates/[id]/versoes  — cria nova versão (snapshot do estado atual)
 *      Body: { comentario?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const postSchema = z.object({
  comentario: z.string().max(500).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const tpl = await db.contratoTemplate.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    select: { id: true, versao: true },
  })
  if (!tpl) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const versoes = await db.contratoTemplateVersao.findMany({
    where: { templateId: params.id },
    orderBy: { versao: 'desc' },
  })
  return NextResponse.json({ versaoAtual: tpl.versao, versoes })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = postSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const tpl = await db.contratoTemplate.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!tpl) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Snapshot do estado atual + bump
  const novaVersao = (tpl.versao ?? 1) + 1
  const result = await db.$transaction(async (tx) => {
    const snap = await tx.contratoTemplateVersao.create({
      data: {
        templateId: tpl.id,
        versao: novaVersao,
        contentJson: tpl.contentJson as any,
        variaveis: (tpl.variaveis as any) ?? undefined,
        createdBy: scope.userId,
        comentario: parsed.data.comentario,
      },
    })
    await tx.contratoTemplate.update({
      where: { id: tpl.id },
      data: { versao: novaVersao },
    })
    return snap
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'create',
    entidade: 'contrato_template_versao',
    entidadeId: result.id,
    mudancas: { templateId: tpl.id, versao: novaVersao },
  })

  return NextResponse.json({ versao: result }, { status: 201 })
}
