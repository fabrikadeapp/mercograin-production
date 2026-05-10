/**
 * S10 M2 — Cenários da calculadora (snapshots por usuário/workspace).
 *
 *  GET  /api/calculadora/cenarios   — lista os cenários do usuário atual
 *  POST /api/calculadora/cenarios   — salva snapshot { nome, inputJson, resultadoJson }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

const cenarioSchema = z.object({
  nome: z.string().min(1).max(120),
  inputJson: z.record(z.any()),
  resultadoJson: z.record(z.any()),
})

export async function GET(_req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const cenarios = await db.cenarioCalculadora.findMany({
    where: { workspaceId: scope.workspaceId, userId: scope.userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ cenarios })
}

export async function POST(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const parsed = cenarioSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 })
  }
  const cenario = await db.cenarioCalculadora.create({
    data: {
      workspaceId: scope.workspaceId,
      userId: scope.userId,
      nome: parsed.data.nome,
      inputJson: parsed.data.inputJson as any,
      resultadoJson: parsed.data.resultadoJson as any,
    },
  })
  return NextResponse.json({ cenario }, { status: 201 })
}
