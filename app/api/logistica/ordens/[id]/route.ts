import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const STATUS_ENUM = z.enum(['agendada', 'em_transito', 'entregue', 'cancelada'])
const GRAO_ENUM = z.enum(['soja', 'milho', 'trigo', 'sorgo'])

const updateSchema = z.object({
  contratoId: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  motoristaId: z.string().optional().nullable(),
  transportadoraId: z.string().optional().nullable(),
  armazemOrigemId: z.string().optional().nullable(),
  armazemDestinoId: z.string().optional().nullable(),
  grao: GRAO_ENUM.optional(),
  quantidadeSc: z.coerce.number().int().positive().optional(),
  pesoToneladas: z.coerce.number().nonnegative().optional().nullable(),
  dataAgendada: z.coerce.date().optional(),
  dataCarregamento: z.coerce.date().optional().nullable(),
  dataDescarga: z.coerce.date().optional().nullable(),
  ctEnumero: z.string().optional().nullable(),
  ctEpdfUrl: z.string().optional().nullable(),
  ctEdataEmissao: z.coerce.date().optional().nullable(),
  status: STATUS_ENUM.optional(),
  observacao: z.string().optional().nullable(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const item = await db.ordemCarga.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      include: {
        motorista: true,
        transportadora: { select: { id: true, razaoSocial: true, telefone: true } },
        armazemOrigem: true,
        armazemDestino: true,
        cliente: { select: { id: true, nome: true } },
        contrato: { select: { id: true, numero: true } },
      },
    })
    if (!item) return NextResponse.json({ error: 'Ordem não encontrada' }, { status: 404 })
    return NextResponse.json(item)
  } catch (error) {
    console.error('Get ordem error:', error)
    return NextResponse.json({ error: 'Erro ao buscar ordem' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const existing = await db.ordemCarga.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) return NextResponse.json({ error: 'Ordem não encontrada' }, { status: 404 })

    const body = await req.json()
    const data = updateSchema.parse(body)

    const updated = await db.ordemCarga.update({
      where: { id: params.id },
      data: { ...data } as any,
    })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Update ordem error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar ordem' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const existing = await db.ordemCarga.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) return NextResponse.json({ error: 'Ordem não encontrada' }, { status: 404 })

    await db.ordemCarga.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'Ordem removida com sucesso' })
  } catch (error) {
    console.error('Delete ordem error:', error)
    return NextResponse.json({ error: 'Erro ao remover ordem' }, { status: 500 })
  }
}
