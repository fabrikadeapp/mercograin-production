import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { proximoNumeroOC } from '@/lib/logistica/numero'

const STATUS_ENUM = z.enum(['agendada', 'em_transito', 'entregue', 'cancelada'])
const GRAO_ENUM = z.enum(['soja', 'milho', 'trigo', 'sorgo'])

const ordemSchema = z.object({
  contratoId: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  motoristaId: z.string().optional().nullable(),
  transportadoraId: z.string().optional().nullable(),
  armazemOrigemId: z.string().optional().nullable(),
  armazemDestinoId: z.string().optional().nullable(),
  grao: GRAO_ENUM,
  quantidadeSc: z.coerce.number().int().positive(),
  pesoToneladas: z.coerce.number().nonnegative().optional().nullable(),
  dataAgendada: z.coerce.date(),
  dataCarregamento: z.coerce.date().optional().nullable(),
  dataDescarga: z.coerce.date().optional().nullable(),
  ctEnumero: z.string().optional().nullable(),
  ctEpdfUrl: z.string().optional().nullable(),
  ctEdataEmissao: z.coerce.date().optional().nullable(),
  status: STATUS_ENUM.optional(),
  observacao: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '100'))
    const status = searchParams.get('status') || ''
    const grao = searchParams.get('grao') || ''
    const dataDe = searchParams.get('dataDe')
    const dataAte = searchParams.get('dataAte')

    const filters: Record<string, any> = {}
    if (status) filters.status = status
    if (grao) filters.grao = grao
    if (dataDe || dataAte) {
      filters.dataAgendada = {}
      if (dataDe) filters.dataAgendada.gte = new Date(dataDe)
      if (dataAte) filters.dataAgendada.lte = new Date(dataAte)
    }

    const where: any = scope.whereOwn(filters)

    const [total, data] = await Promise.all([
      db.ordemCarga.count({ where }),
      db.ordemCarga.findMany({
        where,
        orderBy: [{ dataAgendada: 'desc' }, { numero: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          motorista: { select: { id: true, nome: true, placa: true } },
          transportadora: { select: { id: true, razaoSocial: true } },
          armazemOrigem: { select: { id: true, nome: true, cidade: true, uf: true } },
          armazemDestino: { select: { id: true, nome: true, cidade: true, uf: true } },
          cliente: { select: { id: true, nome: true } },
          contrato: { select: { id: true, numero: true } },
        },
      }),
    ])

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Get ordens error:', error)
    return NextResponse.json({ error: 'Erro ao buscar ordens' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const data = ordemSchema.parse(body)

    // Validar ownership de FKs opcionais
    const checks: Promise<any>[] = []
    if (data.contratoId)
      checks.push(
        db.contrato.findFirst({ where: { id: data.contratoId, ...scope.whereOwn() } }),
      )
    if (data.clienteId)
      checks.push(
        db.cliente.findFirst({ where: { id: data.clienteId, ...scope.whereOwn() } }),
      )
    if (data.motoristaId)
      checks.push(
        db.motorista.findFirst({ where: { id: data.motoristaId, ...scope.whereOwn() } }),
      )
    if (data.transportadoraId)
      checks.push(
        db.fornecedor.findFirst({
          where: { id: data.transportadoraId, ...scope.whereOwn() },
        }),
      )
    if (data.armazemOrigemId)
      checks.push(
        db.armazem.findFirst({
          where: { id: data.armazemOrigemId, ...scope.whereOwn() },
        }),
      )
    if (data.armazemDestinoId)
      checks.push(
        db.armazem.findFirst({
          where: { id: data.armazemDestinoId, ...scope.whereOwn() },
        }),
      )

    const results = await Promise.all(checks)
    if (results.some((r) => r === null)) {
      return NextResponse.json(
        { error: 'Uma das referências (cliente/contrato/motorista/etc) é inválida' },
        { status: 400 },
      )
    }

    const numero = await proximoNumeroOC(scope.workspaceId)

    const created = await db.ordemCarga.create({
      data: {
        numero,
        workspaceId: scope.workspaceId,
        contratoId: data.contratoId || null,
        clienteId: data.clienteId || null,
        motoristaId: data.motoristaId || null,
        transportadoraId: data.transportadoraId || null,
        armazemOrigemId: data.armazemOrigemId || null,
        armazemDestinoId: data.armazemDestinoId || null,
        grao: data.grao,
        quantidadeSc: data.quantidadeSc,
        pesoToneladas: data.pesoToneladas ?? null,
        dataAgendada: data.dataAgendada,
        dataCarregamento: data.dataCarregamento ?? null,
        dataDescarga: data.dataDescarga ?? null,
        ctEnumero: data.ctEnumero || null,
        ctEpdfUrl: data.ctEpdfUrl || null,
        ctEdataEmissao: data.ctEdataEmissao ?? null,
        status: data.status ?? 'agendada',
        observacao: data.observacao || null,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Create ordem error:', error)
    return NextResponse.json({ error: 'Erro ao criar ordem de carga' }, { status: 500 })
  }
}
