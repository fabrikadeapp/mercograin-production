/**
 * Leads = prospects no funil, modelados como Cliente com statusCadastral
 * 'rascunho' (lead novo) ou 'analise' (em qualificação). Ao aprovar, o lead
 * vira cliente efetivo (statusCadastral='aprovado') — reusa toda a base de
 * Cliente sem um model separado.
 *
 * GET  /api/leads            → lista leads (rascunho|analise)
 * POST /api/leads            → cria um lead (cadastro rápido)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const leads = await db.cliente.findMany({
    where: scope.whereOwn({ statusCadastral: { in: ['rascunho', 'analise'] } }),
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, nome: true, email: true, whatsapp: true, telefone: true,
      tipo: true, statusCadastral: true, createdAt: true,
    },
  })
  return NextResponse.json({ ok: true, leads })
}

const schema = z.object({
  nome: z.string().min(2, 'Informe o nome'),
  email: z.string().email().optional().or(z.literal('')),
  whatsapp: z.string().optional(),
  telefone: z.string().optional(),
  tipo: z.enum(['comprador', 'vendedor', 'ambos']).default('vendedor'),
})

export async function POST(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }
  const d = parsed.data

  const lead = await db.cliente.create({
    data: {
      workspaceId: scope.workspaceId,
      nome: d.nome,
      email: d.email || null,
      whatsapp: d.whatsapp || null,
      telefone: d.telefone || null,
      tipo: d.tipo,
      statusCadastral: 'rascunho', // = lead no funil
      ativo: true,
    },
    select: { id: true, nome: true },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'lead_criado',
    entidade: 'cliente',
    entidadeId: lead.id,
    mudancas: { nome: lead.nome, origem: 'cadastro_manual' },
  }).catch(() => undefined)

  return NextResponse.json({ ok: true, lead })
}
