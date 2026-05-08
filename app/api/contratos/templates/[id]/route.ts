import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { extractVariables } from '@/lib/contratos/render-template'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  nome: z.string().min(1).optional(),
  tipo: z.enum(['venda', 'compra', 'intermediacao', 'outros']).optional(),
  descricao: z.string().optional().nullable(),
  contentJson: z.any().optional(),
  ativo: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})

async function getOwned(id: string, scope: NonNullable<Awaited<ReturnType<typeof getScope>>>) {
  return db.contratoTemplate.findFirst({
    where: { id, ...scope.whereOwn() },
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const template = await getOwned(params.id, scope)
    if (!template) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ template })
  } catch (e: any) {
    console.error('[templates GET id]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const existing = await getOwned(params.id, scope)
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const body = await req.json()
    const data = updateSchema.parse(body)

    const tipoFinal = data.tipo ?? existing.tipo
    if (data.isDefault) {
      await db.contratoTemplate.updateMany({
        where: {
          workspaceId: scope.workspaceId,
          tipo: tipoFinal,
          isDefault: true,
          NOT: { id: params.id },
        },
        data: { isDefault: false },
      })
    }

    const variaveis =
      data.contentJson !== undefined
        ? extractVariables(data.contentJson)
        : (existing.variaveis as any)

    const template = await db.contratoTemplate.update({
      where: { id: params.id },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.tipo !== undefined && { tipo: data.tipo }),
        ...(data.descricao !== undefined && { descricao: data.descricao }),
        ...(data.contentJson !== undefined && { contentJson: data.contentJson }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        variaveis,
      },
    })
    return NextResponse.json({ template })
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message }, { status: 400 })
    }
    console.error('[templates PUT]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const existing = await getOwned(params.id, scope)
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // Soft delete: archive (ativo=false). To hard-delete pass ?hard=true.
    const url = new URL(_req.url)
    if (url.searchParams.get('hard') === 'true') {
      await db.contratoTemplate.delete({ where: { id: params.id } })
    } else {
      await db.contratoTemplate.update({
        where: { id: params.id },
        data: { ativo: false, isDefault: false },
      })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[templates DELETE]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
