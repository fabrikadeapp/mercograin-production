import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const balancaSchema = z.object({
  nome: z.string().min(2),
  modelo: z.string().optional().nullable(),
  fabricante: z.string().optional().nullable(),
  armazemId: z.string().optional().nullable(),
  capacidadeMaxKg: z.coerce.number().int().positive().optional(),
  precisaoKg: z.coerce.number().int().positive().optional(),
  tipoIntegracao: z.enum(['manual', 'serial', 'tcp', 'api']).optional(),
  enderecoIntegracao: z.string().optional().nullable(),
  ativa: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const armazemId = searchParams.get('armazemId') || undefined
  const ativaParam = searchParams.get('ativa')
  const filters: any = {}
  if (armazemId) filters.armazemId = armazemId
  if (ativaParam !== null && ativaParam !== '') filters.ativa = ativaParam === 'true'
  const data = await db.balanca.findMany({
    where: scope.whereOwn(filters),
    orderBy: { nome: 'asc' },
    include: { armazem: { select: { id: true, nome: true } } },
  })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await request.json()
    const data = balancaSchema.parse(body)
    if (data.armazemId) {
      const a = await db.armazem.findFirst({
        where: { id: data.armazemId, ...scope.whereOwn() },
      })
      if (!a) return NextResponse.json({ error: 'Armazém inválido' }, { status: 400 })
    }
    const created = await db.balanca.create({
      data: {
        nome: data.nome,
        modelo: data.modelo || null,
        fabricante: data.fabricante || null,
        armazemId: data.armazemId || null,
        capacidadeMaxKg: data.capacidadeMaxKg ?? 80000,
        precisaoKg: data.precisaoKg ?? 20,
        tipoIntegracao: data.tipoIntegracao ?? 'manual',
        enderecoIntegracao: data.enderecoIntegracao || null,
        ativa: data.ativa ?? true,
        workspaceId: scope.workspaceId,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    console.error('POST balanca error', e)
    return NextResponse.json({ error: 'Erro ao criar balança' }, { status: 500 })
  }
}
