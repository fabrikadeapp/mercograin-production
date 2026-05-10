/**
 * S10 M2 — CRUD de Ofertas (multi-tenant estrito).
 *
 *  GET  /api/ofertas?cultura=&tipo=&status=&precoMin=&precoMax=
 *  POST /api/ofertas   { tipo, cultura, qtdSc, precoSc, ... }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'
import {
  buildWhere,
  calcValidaAte,
  expirarVencidas,
  gerarNumeroOferta,
} from '@/lib/ofertas/service'

export const dynamic = 'force-dynamic'

const ofertaSchema = z.object({
  tipo: z.enum(['compra', 'venda']),
  cultura: z.string().min(2).max(30),
  qtdSc: z.number().positive(),
  precoSc: z.number().positive(),
  precoMoeda: z.enum(['BRL', 'USD']).default('BRL'),
  origem: z.string().length(2).optional().nullable(),
  destino: z.string().length(2).optional().nullable(),
  validadeHoras: z.number().int().min(1).max(720).default(72),
  publica: z.boolean().default(false),
  observacao: z.string().max(1000).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const scope = await getScope(req.nextUrl.searchParams)
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Best-effort: expira ofertas vencidas no workspace antes de listar
  await expirarVencidas(scope.workspaceId).catch(() => {})

  const sp = req.nextUrl.searchParams
  const where = buildWhere(scope.workspaceId, {
    cultura: sp.get('cultura') || undefined,
    tipo: (sp.get('tipo') as any) || undefined,
    status: sp.get('status') || undefined,
    precoMin: sp.get('precoMin') ? Number(sp.get('precoMin')) : undefined,
    precoMax: sp.get('precoMax') ? Number(sp.get('precoMax')) : undefined,
  })

  const ofertas = await db.oferta.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ ofertas })
}

export async function POST(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = ofertaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 })
  }
  const d = parsed.data
  const numero = gerarNumeroOferta()
  const validaAte = calcValidaAte(d.validadeHoras)

  const oferta = await db.oferta.create({
    data: {
      workspaceId: scope.workspaceId,
      proprietarioId: scope.userId,
      numero,
      tipo: d.tipo,
      cultura: d.cultura,
      qtdSc: d.qtdSc,
      precoSc: d.precoSc,
      precoMoeda: d.precoMoeda,
      origem: d.origem ?? null,
      destino: d.destino ?? null,
      validadeHoras: d.validadeHoras,
      validaAte,
      publica: d.publica,
      observacao: d.observacao ?? null,
    },
  })

  // Audit log de criação
  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'create',
    entidade: 'oferta',
    entidadeId: oferta.id,
    mudancas: {
      numero: oferta.numero,
      tipo: oferta.tipo,
      cultura: oferta.cultura,
      qtdSc: Number(oferta.qtdSc),
      precoSc: Number(oferta.precoSc),
      publica: oferta.publica,
    },
  })

  return NextResponse.json({ oferta }, { status: 201 })
}
