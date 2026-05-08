import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const TIPO_ENUM = z.enum(['silo', 'granel', 'horizontal', 'misto'])

const updateSchema = z.object({
  nome: z.string().min(2).optional(),
  tipo: TIPO_ENUM.optional(),
  capacidadeSc: z.coerce.number().int().nonnegative().optional(),
  endereco: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  cep: z.string().optional().nullable(),
  contato: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  proprio: z.boolean().optional(),
  fornecedorId: z.string().optional().nullable(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const item = await db.armazem.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: { fornecedor: { select: { id: true, razaoSocial: true } } },
    })
    if (!item) return NextResponse.json({ error: 'Armazém não encontrado' }, { status: 404 })
    return NextResponse.json(item)
  } catch (error) {
    console.error('Get armazem error:', error)
    return NextResponse.json({ error: 'Erro ao buscar armazém' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const existing = await db.armazem.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) return NextResponse.json({ error: 'Armazém não encontrado' }, { status: 404 })

    const body = await req.json()
    const data = updateSchema.parse(body)

    if (data.fornecedorId) {
      const f = await db.fornecedor.findFirst({
        where: { id: data.fornecedorId, ...scope.whereOwn() },
      })
      if (!f) return NextResponse.json({ error: 'Fornecedor inválido' }, { status: 400 })
    }

    const updated = await db.armazem.update({
      where: { id: params.id },
      data: { ...data } as any,
    })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Update armazem error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar armazém' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const existing = await db.armazem.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) return NextResponse.json({ error: 'Armazém não encontrado' }, { status: 404 })

    await db.armazem.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'Armazém removido com sucesso' })
  } catch (error) {
    console.error('Delete armazem error:', error)
    return NextResponse.json({ error: 'Erro ao remover armazém' }, { status: 500 })
  }
}
