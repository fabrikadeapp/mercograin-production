/**
 * Checklist documental de exportação por contrato (F4-05). Feature 'eudr'.
 *
 * GET   → itens do checklist (semeia os padrão na 1ª vez)
 * POST  → adiciona item { tipo, titulo, vencimento? }
 * PATCH → atualiza item { id, status?, arquivoUrl?, vencimento?, observacao? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/features'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PADRAO: Array<{ tipo: string; titulo: string }> = [
  { tipo: 'due', titulo: 'DUE — Declaração Única de Exportação' },
  { tipo: 'fitossanitario', titulo: 'Certificado Fitossanitário' },
  { tipo: 'certificado_origem', titulo: 'Certificado de Origem' },
  { tipo: 'booking', titulo: 'Booking (reserva de praça)' },
  { tipo: 'bl', titulo: 'Bill of Lading (BL)' },
  { tipo: 'invoice', titulo: 'Commercial Invoice' },
  { tipo: 'packing_list', titulo: 'Packing List' },
  { tipo: 'seguro', titulo: 'Apólice de Seguro' },
]

async function guard(contratoId: string) {
  const scope = await getScope()
  if (!scope) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  if (!(await isFeatureEnabled(scope.workspaceId, 'eudr'))) {
    return { error: NextResponse.json({ error: 'feature_disabled' }, { status: 403 }) }
  }
  const contrato = await db.contrato.findFirst({ where: { id: contratoId, ...scope.whereOwn() }, select: { id: true } })
  if (!contrato) return { error: NextResponse.json({ error: 'not_found' }, { status: 404 }) }
  return { scope }
}

export async function GET(_req: NextRequest, { params }: { params: { contratoId: string } }) {
  const g = await guard(params.contratoId)
  if (g.error) return g.error
  const scope = g.scope!

  let itens = await db.checklistExportacaoItem.findMany({
    where: { contratoId: params.contratoId, ...scope.whereOwn() },
    orderBy: { createdAt: 'asc' },
  })

  // Semeia o padrão na primeira vez.
  if (itens.length === 0) {
    await db.checklistExportacaoItem.createMany({
      data: PADRAO.map((p) => ({ workspaceId: scope.workspaceId, contratoId: params.contratoId, tipo: p.tipo, titulo: p.titulo })),
    })
    itens = await db.checklistExportacaoItem.findMany({ where: { contratoId: params.contratoId, ...scope.whereOwn() }, orderBy: { createdAt: 'asc' } })
  }

  const concluidos = itens.filter((i) => i.status === 'aprovado').length
  return NextResponse.json({ ok: true, itens, progresso: { concluidos, total: itens.length } })
}

const postSchema = z.object({ tipo: z.string().min(1), titulo: z.string().min(1), vencimento: z.string().optional() })

export async function POST(req: NextRequest, { params }: { params: { contratoId: string } }) {
  const g = await guard(params.contratoId)
  if (g.error) return g.error
  const scope = g.scope!
  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const item = await db.checklistExportacaoItem.create({
    data: {
      workspaceId: scope.workspaceId, contratoId: params.contratoId,
      tipo: parsed.data.tipo, titulo: parsed.data.titulo,
      vencimento: parsed.data.vencimento ? new Date(parsed.data.vencimento) : null,
    },
  })
  return NextResponse.json({ ok: true, item })
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['pendente', 'em_andamento', 'enviado', 'aprovado', 'rejeitado']).optional(),
  arquivoUrl: z.string().optional(),
  vencimento: z.string().nullable().optional(),
  observacao: z.string().max(500).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { contratoId: string } }) {
  const g = await guard(params.contratoId)
  if (g.error) return g.error
  const scope = g.scope!
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const { id, ...rest } = parsed.data
  const exists = await db.checklistExportacaoItem.findFirst({ where: { id, contratoId: params.contratoId, ...scope.whereOwn() }, select: { id: true } })
  if (!exists) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  await db.checklistExportacaoItem.update({
    where: { id },
    data: {
      ...(rest.status ? { status: rest.status, ...(rest.status === 'enviado' ? { enviadoEm: new Date() } : {}) } : {}),
      ...(rest.arquivoUrl !== undefined ? { arquivoUrl: rest.arquivoUrl } : {}),
      ...(rest.vencimento !== undefined ? { vencimento: rest.vencimento ? new Date(rest.vencimento) : null } : {}),
      ...(rest.observacao !== undefined ? { observacao: rest.observacao } : {}),
    },
  })
  return NextResponse.json({ ok: true })
}
