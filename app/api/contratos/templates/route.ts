import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { extractVariables } from '@/lib/contratos/render-template'

export const dynamic = 'force-dynamic'

const templateSchema = z.object({
  nome: z.string().min(1),
  tipo: z.enum(['venda', 'compra', 'intermediacao', 'outros']),
  descricao: z.string().optional().nullable(),
  contentJson: z.any(),
  variaveis: z.any().optional().nullable(),
  ativo: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const tipo = searchParams.get('tipo') || ''
    const ativoParam = searchParams.get('ativo')

    const where: any = scope.whereOwn()
    if (tipo) where.tipo = tipo
    if (ativoParam === 'true') where.ativo = true
    if (ativoParam === 'false') where.ativo = false

    const templates = await db.contratoTemplate.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        nome: true,
        tipo: true,
        descricao: true,
        ativo: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ templates })
  } catch (e: any) {
    console.error('[contratos/templates GET]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const body = await req.json()
    const data = templateSchema.parse(body)

    // If isDefault, unset previous defaults of same tipo (one default per tipo)
    if (data.isDefault) {
      await db.contratoTemplate.updateMany({
        where: { workspaceId: scope.workspaceId, tipo: data.tipo, isDefault: true },
        data: { isDefault: false },
      })
    }

    const variaveis = data.variaveis ?? extractVariables(data.contentJson)

    const template = await db.contratoTemplate.create({
      data: {
        workspaceId: scope.workspaceId,
        nome: data.nome,
        tipo: data.tipo,
        descricao: data.descricao ?? null,
        contentJson: data.contentJson,
        variaveis,
        ativo: data.ativo ?? true,
        isDefault: data.isDefault ?? false,
      },
    })
    return NextResponse.json({ template }, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message }, { status: 400 })
    }
    console.error('[contratos/templates POST]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
