/**
 * S4 M1 — Endpoints de Propriedades Rurais.
 *
 * GET  /api/propriedades?produtorId=... — lista
 * POST /api/propriedades                — cria
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isValidCarFormat, formatCar } from '@/lib/br/car'
import { logAudit } from '@/lib/audit/log'

const createSchema = z.object({
  produtorId: z.string().min(1),
  nome: z.string().min(2),
  matricula: z.string().optional(),
  cartorio: z.string().optional(),
  nirf: z.string().optional(),
  incra: z.string().optional(),
  itr: z.string().optional(),
  car: z
    .string()
    .optional()
    .refine((v) => !v || isValidCarFormat(v), { message: 'CAR em formato inválido' }),
  areaTotalHa: z.number().nonnegative().optional(),
  areaPlantavelHa: z.number().nonnegative().optional(),
  areaReservaLegal: z.number().nonnegative().optional(),
  areaPreservacaoPermanente: z.number().nonnegative().optional(),
  areaConsolidada: z.number().nonnegative().optional(),
  geoJson: z.any().optional(),
  centroideLat: z.number().optional(),
  centroideLng: z.number().optional(),
  municipio: z.string().optional(),
  uf: z.string().length(2).optional(),
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const produtorId = searchParams.get('produtorId') || undefined
  const propriedades = await db.propriedadeRural.findMany({
    where: { ...scope.whereOwn(), ...(produtorId ? { produtorId } : {}), ativo: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(propriedades)
}

export async function POST(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validação falhou', detail: parsed.error.format() }, { status: 400 })
  }
  const data = parsed.data

  // Garante produtor pertence ao workspace
  const produtor = await db.cliente.findFirst({
    where: { id: data.produtorId, ...scope.whereOwn() },
    select: { id: true },
  })
  if (!produtor) {
    return NextResponse.json({ error: 'Produtor não encontrado no workspace' }, { status: 404 })
  }

  const created = await db.propriedadeRural.create({
    data: {
      workspaceId: scope.workspaceId,
      produtorId: data.produtorId,
      nome: data.nome,
      matricula: data.matricula || null,
      cartorio: data.cartorio || null,
      nirf: data.nirf || null,
      incra: data.incra || null,
      itr: data.itr || null,
      car: data.car ? formatCar(data.car) : null,
      areaTotalHa: data.areaTotalHa ?? null,
      areaPlantavelHa: data.areaPlantavelHa ?? null,
      areaReservaLegal: data.areaReservaLegal ?? null,
      areaPreservacaoPermanente: data.areaPreservacaoPermanente ?? null,
      areaConsolidada: data.areaConsolidada ?? null,
      geoJson: data.geoJson ?? undefined,
      centroideLat: data.centroideLat ?? null,
      centroideLng: data.centroideLng ?? null,
      municipio: data.municipio || null,
      uf: data.uf || null,
    },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'create',
    entidade: 'propriedade_rural',
    entidadeId: created.id,
    mudancas: { nome: created.nome, produtorId: created.produtorId },
  })

  return NextResponse.json(created, { status: 201 })
}
