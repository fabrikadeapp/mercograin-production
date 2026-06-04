/**
 * PATCH /api/admin/leads/[id]
 * Body: { status?, observacao?, ultimoContatoEm? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STATUS = ['novo', 'qualificado', 'em_contato', 'proposta', 'fechado', 'descartado'] as const

const schema = z.object({
  status: z.enum(STATUS).optional(),
  observacao: z.string().max(2000).optional(),
  ultimoContatoEm: z.string().datetime().optional(),
})

async function requireSuperAdmin() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = session?.user as any
  if (!u?.id || u.role !== 'admin') return null
  return u
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const u = await requireSuperAdmin()
  if (!u) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const data = parsed.data
  const lead = await db.lead.update({
    where: { id: params.id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.observacao !== undefined ? { observacao: data.observacao } : {}),
      ...(data.ultimoContatoEm
        ? { ultimoContatoEm: new Date(data.ultimoContatoEm) }
        : data.status && data.status !== 'novo'
        ? { ultimoContatoEm: new Date() }
        : {}),
    },
  })
  await logAudit({
    userId: u.id,
    workspaceId: 'system',
    acao: 'update',
    entidade: 'Lead',
    entidadeId: lead.id,
    mudancas: data,
  }).catch(() => undefined)
  return NextResponse.json({ ok: true, lead })
}
