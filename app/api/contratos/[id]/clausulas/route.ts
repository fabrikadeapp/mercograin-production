/**
 * GET  /api/contratos/[id]/clausulas       — lista cláusulas do contrato
 * POST /api/contratos/[id]/clausulas       — cria cláusula
 *      Body: { ordem, tipo, titulo, texto, obrigatoria? }
 *      ou Body: { fromTemplateId } para copiar cláusulas do template
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const TIPOS = [
  'multa',
  'arbitragem',
  'foro',
  'forca_maior',
  'pagamento',
  'entrega',
  'outras',
] as const

const createSchema = z.union([
  z.object({
    ordem: z.number().int().min(0),
    tipo: z.enum(TIPOS),
    titulo: z.string().min(1),
    texto: z.string().min(1),
    obrigatoria: z.boolean().optional(),
  }),
  z.object({ fromTemplateId: z.string().min(1) }),
])

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const contrato = await db.contrato.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    select: { id: true },
  })
  if (!contrato) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const clausulas = await db.clausulaContrato.findMany({
    where: { contratoId: params.id, workspaceId: scope.workspaceId },
    orderBy: { ordem: 'asc' },
  })
  return NextResponse.json({ clausulas })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const contrato = await db.contrato.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    select: { id: true },
  })
  if (!contrato) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if ('fromTemplateId' in parsed.data) {
    const tplClausulas = await db.clausulaContrato.findMany({
      where: {
        templateId: parsed.data.fromTemplateId,
        workspaceId: scope.workspaceId,
        contratoId: null,
      },
      orderBy: { ordem: 'asc' },
    })
    if (tplClausulas.length === 0) {
      return NextResponse.json({ ok: true, copiadas: 0 })
    }
    const created = await db.$transaction(
      tplClausulas.map((c) =>
        db.clausulaContrato.create({
          data: {
            workspaceId: scope.workspaceId,
            contratoId: params.id,
            templateId: null,
            ordem: c.ordem,
            tipo: c.tipo,
            titulo: c.titulo,
            texto: c.texto,
            obrigatoria: c.obrigatoria,
          },
        })
      )
    )
    await logAudit({
      userId: scope.userId,
      workspaceId: scope.workspaceId,
      acao: 'create',
      entidade: 'clausula_contrato',
      entidadeId: params.id,
      mudancas: { copiadas: created.length, fromTemplate: parsed.data.fromTemplateId },
    })
    return NextResponse.json({ ok: true, copiadas: created.length, clausulas: created })
  }

  const cl = await db.clausulaContrato.create({
    data: {
      workspaceId: scope.workspaceId,
      contratoId: params.id,
      ordem: parsed.data.ordem,
      tipo: parsed.data.tipo,
      titulo: parsed.data.titulo,
      texto: parsed.data.texto,
      obrigatoria: parsed.data.obrigatoria ?? true,
    },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'create',
    entidade: 'clausula_contrato',
    entidadeId: cl.id,
  })

  return NextResponse.json({ clausula: cl }, { status: 201 })
}
