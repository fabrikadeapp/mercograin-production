/**
 * Margens pré-setadas de um cliente (grão × tipo). Sobrepõem a margem global
 * na geração automática de preço (automação WhatsApp→proposta).
 *
 * GET → margens do cliente + margens globais (referência)
 * PUT → salva/atualiza uma margem { grao, tipo, pct, ativo? }
 * DELETE → remove uma margem { grao, tipo }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function ensureCliente(id: string) {
  const scope = await getScope()
  if (!scope) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  const cliente = await db.cliente.findFirst({ where: { id, ...scope.whereOwn() }, select: { id: true } })
  if (!cliente) return { error: NextResponse.json({ error: 'not_found' }, { status: 404 }) }
  return { scope }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await ensureCliente(params.id)
  if (g.error) return g.error
  const scope = g.scope!
  const [margens, globais] = await Promise.all([
    db.margemCliente.findMany({ where: { clienteId: params.id, ...scope.whereOwn() }, orderBy: [{ grao: 'asc' }, { tipo: 'asc' }] }),
    db.commodityMarginRule.findMany({ where: scope.whereOwn({ ativa: true }), select: { commodity: true, margemPercent: true } }),
  ])
  return NextResponse.json({
    ok: true,
    margens: margens.map((m) => ({ grao: m.grao, tipo: m.tipo, pct: m.pct, ativo: m.ativo })),
    globais: globais.map((g) => ({ commodity: g.commodity, pct: Number(g.margemPercent) })),
  })
}

const putSchema = z.object({
  grao: z.string().min(1),
  tipo: z.enum(['compra', 'venda']),
  pct: z.number().min(0).max(100),
  ativo: z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await ensureCliente(params.id)
  if (g.error) return g.error
  const scope = g.scope!
  if (scope.workspaceRole !== 'owner' && scope.workspaceRole !== 'admin' && !scope.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const parsed = putSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const d = parsed.data
  await db.margemCliente.upsert({
    where: { workspaceId_clienteId_grao_tipo: { workspaceId: scope.workspaceId, clienteId: params.id, grao: d.grao.toLowerCase(), tipo: d.tipo } },
    create: { workspaceId: scope.workspaceId, clienteId: params.id, grao: d.grao.toLowerCase(), tipo: d.tipo, pct: d.pct, ativo: d.ativo ?? true },
    update: { pct: d.pct, ativo: d.ativo ?? true },
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await ensureCliente(params.id)
  if (g.error) return g.error
  const scope = g.scope!
  const { searchParams } = new URL(req.url)
  const grao = searchParams.get('grao')?.toLowerCase()
  const tipo = searchParams.get('tipo')
  if (!grao || !tipo) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  await db.margemCliente.deleteMany({ where: { clienteId: params.id, grao, tipo, ...scope.whereOwn() } })
  return NextResponse.json({ ok: true })
}
