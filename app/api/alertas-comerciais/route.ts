/**
 * Alertas comerciais (F2-03/F3-02). CommercialAlert gerado pelos crons
 * (price-alerts, propostas-followup, bhgrain-alertas).
 *
 * GET   → lista alertas abertos por severidade/categoria + contagem
 * PATCH → resolve/ignora um alerta { id, acao: 'resolver'|'ignorar' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const incluirResolvidos = searchParams.get('todos') === '1'
  const alertas = await db.commercialAlert.findMany({
    where: scope.whereOwn(incluirResolvidos ? {} : { status: 'aberto' }),
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
    select: { id: true, severity: true, category: true, title: true, description: true, relatedEntityType: true, relatedEntityId: true, status: true, createdAt: true },
  })

  const ordem: Record<string, number> = { critico: 3, atencao: 2, informativo: 1 }
  alertas.sort((a, b) => (ordem[b.severity] ?? 0) - (ordem[a.severity] ?? 0))

  return NextResponse.json({
    ok: true,
    alertas,
    contagem: {
      total: alertas.length,
      critico: alertas.filter((a) => a.severity === 'critico' && a.status === 'aberto').length,
      atencao: alertas.filter((a) => a.severity === 'atencao' && a.status === 'aberto').length,
    },
  })
}

const patchSchema = z.object({ id: z.string().min(1), acao: z.enum(['resolver', 'ignorar']) })

export async function PATCH(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const { id, acao } = parsed.data

  const alerta = await db.commercialAlert.findFirst({ where: { id, ...scope.whereOwn() }, select: { id: true } })
  if (!alerta) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  await db.commercialAlert.update({
    where: { id },
    data: { status: acao === 'resolver' ? 'resolvido' : 'ignorado', resolvedAt: new Date(), resolvedBy: scope.userId },
  })
  return NextResponse.json({ ok: true })
}
