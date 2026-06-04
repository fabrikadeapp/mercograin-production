/**
 * POST /api/admin/clean-mocks?dry=true
 *
 * Endpoint TEMPORÁRIO para limpar propostas de seed/teste do workspace
 * autenticado. Critério: criadaEm < 2026-06-04 (data da sessão de teste real).
 *
 * Auth: Bearer ${CRON_SECRET}
 *
 * Body:
 *   { criadaAntes: 'ISO date', dryRun?: boolean }
 *
 * REMOVER APOS USO.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  criadaAntes: z.string(),
  workspaceSlug: z.string().optional(),
  workspaceId: z.string().optional(),
  dryRun: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const data = schema.parse(body)
  const corte = new Date(data.criadaAntes)
  if (isNaN(corte.getTime())) {
    return NextResponse.json({ error: 'criadaAntes invalido' }, { status: 400 })
  }

  // Resolve workspaceId
  let wsId = data.workspaceId
  if (!wsId && data.workspaceSlug) {
    const ws = await db.workspace.findUnique({
      where: { slug: data.workspaceSlug },
      select: { id: true },
    })
    if (!ws) {
      return NextResponse.json({ error: 'Workspace nao encontrado pelo slug' }, { status: 404 })
    }
    wsId = ws.id
  }
  if (!wsId) {
    // Lista workspaces para o caller escolher
    const workspaces = await db.workspace.findMany({
      select: { id: true, name: true, slug: true },
    })
    return NextResponse.json({ error: 'workspaceId ou workspaceSlug obrigatorio', workspaces }, { status: 400 })
  }

  // 1. Lista o que seria deletado
  const propostas = await db.proposta.findMany({
    where: {
      workspaceId: wsId,
      criadaEm: { lt: corte },
    },
    select: {
      id: true,
      numero: true,
      criadaEm: true,
      status: true,
      valorTotal: true,
      cliente: { select: { nome: true } },
      contratos: { select: { id: true, numero: true } },
    },
    orderBy: { criadaEm: 'asc' },
  })

  if (data.dryRun) {
    return NextResponse.json({
      dryRun: true,
      total: propostas.length,
      propostas: propostas.map((p) => ({
        id: p.id,
        numero: p.numero,
        criadaEm: p.criadaEm.toISOString(),
        status: p.status,
        valorTotal: p.valorTotal.toString(),
        cliente: p.cliente?.nome,
        contratosVinculados: p.contratos.length,
      })),
    })
  }

  // 2. Delete em cascade (Prisma cascade vai matar contratos, notas, agenda)
  const ids = propostas.map((p) => p.id)
  const contratoIds = propostas.flatMap((p) => p.contratos.map((c) => c.id))

  // Audit log de cada deleção
  for (const p of propostas) {
    await db.auditLog
      .create({
        data: {
          userId: 'admin_clean_mocks',
          workspaceId: wsId,
          acao: 'proposta_deletada_clean_mocks',
          entidade: 'proposta',
          entidadeId: p.id,
          mudancas: {
            numero: p.numero,
            criadaEm: p.criadaEm.toISOString(),
            status: p.status,
            valorTotal: p.valorTotal.toString(),
            cliente: p.cliente?.nome,
            contratosDeletados: p.contratos.map((c) => c.numero),
          },
        },
      })
      .catch(() => undefined)
  }

  // Deleta — contratos primeiro (depois propostas em cascade levaria, mas FKs de contrato
  // dependem de proposta, então prisma cascade já trata. Garantia explícita:)
  if (contratoIds.length > 0) {
    await db.contrato.deleteMany({ where: { id: { in: contratoIds } } })
  }
  const r = await db.proposta.deleteMany({ where: { id: { in: ids } } })

  return NextResponse.json({
    dryRun: false,
    propostasDeletadas: r.count,
    contratosDeletados: contratoIds.length,
    ids,
  })
}
