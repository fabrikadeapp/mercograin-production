import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const updateSchema = z.object({
  nome: z.string().min(2).optional(),
  cpf: z.string().optional().nullable(),
  cnh: z.string().optional().nullable(),
  cnhCategoria: z.string().max(5).optional().nullable(),
  telefone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  placa: z.string().max(10).optional().nullable(),
  veiculo: z.string().optional().nullable(),
  capacidadeSc: z.coerce.number().int().nonnegative().optional().nullable(),
  transportadoraId: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const item = await db.motorista.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: { transportadora: { select: { id: true, razaoSocial: true } } },
    })
    if (!item) return NextResponse.json({ error: 'Motorista não encontrado' }, { status: 404 })
    return NextResponse.json(item)
  } catch (error) {
    console.error('Get motorista error:', error)
    return NextResponse.json({ error: 'Erro ao buscar motorista' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const existing = await db.motorista.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) return NextResponse.json({ error: 'Motorista não encontrado' }, { status: 404 })

    const body = await req.json()
    const data = updateSchema.parse(body)

    if (data.transportadoraId) {
      const f = await db.fornecedor.findFirst({
        where: { id: data.transportadoraId, ...scope.whereOwn() },
      })
      if (!f) return NextResponse.json({ error: 'Transportadora inválida' }, { status: 400 })
    }

    const updated = await db.motorista.update({
      where: { id: params.id },
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
      } as any,
    })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Update motorista error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar motorista' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const existing = await db.motorista.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) return NextResponse.json({ error: 'Motorista não encontrado' }, { status: 404 })

    await db.motorista.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'Motorista removido com sucesso' })
  } catch (error) {
    console.error('Delete motorista error:', error)
    return NextResponse.json({ error: 'Erro ao remover motorista' }, { status: 500 })
  }
}
