import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isValidCarFormat, formatCar } from '@/lib/br/car'
import { logAudit } from '@/lib/audit/log'

const updateSchema = z.object({
  nome: z.string().min(2).optional(),
  matricula: z.string().optional().nullable(),
  cartorio: z.string().optional().nullable(),
  nirf: z.string().optional().nullable(),
  incra: z.string().optional().nullable(),
  itr: z.string().optional().nullable(),
  car: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || isValidCarFormat(v), { message: 'CAR inválido' }),
  areaTotalHa: z.number().nonnegative().optional().nullable(),
  areaPlantavelHa: z.number().nonnegative().optional().nullable(),
  areaReservaLegal: z.number().nonnegative().optional().nullable(),
  areaPreservacaoPermanente: z.number().nonnegative().optional().nullable(),
  areaConsolidada: z.number().nonnegative().optional().nullable(),
  geoJson: z.any().optional(),
  centroideLat: z.number().optional().nullable(),
  centroideLng: z.number().optional().nullable(),
  municipio: z.string().optional().nullable(),
  uf: z.string().length(2).optional().nullable(),
  ativo: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const prop = await db.propriedadeRural.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!prop) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  return NextResponse.json(prop)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existing = await db.propriedadeRural.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', detail: parsed.error.format() }, { status: 400 })
  }
  const data = parsed.data

  const updated = await db.propriedadeRural.update({
    where: { id: params.id },
    data: {
      ...data,
      car: data.car !== undefined ? (data.car ? formatCar(data.car) : null) : undefined,
    },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'update',
    entidade: 'propriedade_rural',
    entidadeId: updated.id,
    mudancas: data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existing = await db.propriedadeRural.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  await db.propriedadeRural.update({
    where: { id: params.id },
    data: { ativo: false },
  })
  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'delete',
    entidade: 'propriedade_rural',
    entidadeId: params.id,
  })
  return NextResponse.json({ ok: true })
}
