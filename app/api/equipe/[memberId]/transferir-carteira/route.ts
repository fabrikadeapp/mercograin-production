import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

const schema = z.object({
  destinatarioId: z.string().min(1),
  /** Se omitido, transfere TODOS os clientes do origem. */
  clienteIds: z.array(z.string()).optional(),
  motivo: z.string().max(200).optional(),
  observacao: z.string().max(2000).optional(),
})

/**
 * POST /api/equipe/{memberId}/transferir-carteira
 *
 * Move clientes responsáveis do `memberId` (origem) para `destinatarioId`.
 *
 * Lógica:
 *  1. Para cada cliente: fecha ClienteAtendimento ativo do origem (fimEm=now,
 *     motivo='transferencia') e cria novo registro para o destinatário.
 *  2. Atualiza Cliente.responsavelId = destinatarioId.
 *  3. NÃO altera vendedorId histórico de propostas/contratos — preserva crédito.
 *
 * Gate: owner / admin do workspace (ou admin global).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { memberId: string } },
) {
  let scope
  try {
    scope = await requireScope()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (
    !scope.isAdmin &&
    scope.workspaceRole !== 'owner' &&
    scope.workspaceRole !== 'admin'
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'invalid' },
      { status: 400 },
    )
  }
  const { destinatarioId, clienteIds, motivo, observacao } = parsed.data

  if (destinatarioId === params.memberId) {
    return NextResponse.json(
      { error: 'origem_e_destino_iguais' },
      { status: 400 },
    )
  }

  // Valida que ambos os memberships existem no workspace
  const [origem, destino] = await Promise.all([
    db.workspaceMember.findFirst({
      where: { id: params.memberId, workspaceId: scope.workspaceId },
      select: { id: true, email: true, user: { select: { nome: true } } },
    }),
    db.workspaceMember.findFirst({
      where: { id: destinatarioId, workspaceId: scope.workspaceId },
      select: { id: true, email: true, user: { select: { nome: true } } },
    }),
  ])
  if (!origem || !destino) {
    return NextResponse.json({ error: 'membership_invalido' }, { status: 404 })
  }

  // Clientes alvo: filtra pelo conjunto (se informado) E pelo responsavelId = origem
  const where: any = {
    workspaceId: scope.workspaceId,
    responsavelId: origem.id,
  }
  if (clienteIds && clienteIds.length > 0) {
    where.id = { in: clienteIds }
  }

  const clientesAlvo = await db.cliente.findMany({
    where,
    select: { id: true, nome: true },
  })

  if (clientesAlvo.length === 0) {
    return NextResponse.json({ ok: true, transferidos: 0 })
  }

  const now = new Date()

  // Transação: fecha atendimentos antigos, cria novos, atualiza responsavelId.
  const result = await db.$transaction(async (tx) => {
    // 1. Fecha ClienteAtendimento ativos do origem para esses clientes
    await tx.clienteAtendimento.updateMany({
      where: {
        memberId: origem.id,
        clienteId: { in: clientesAlvo.map((c) => c.id) },
        fimEm: null,
      },
      data: {
        fimEm: now,
      },
    })

    // 2. Cria novos atendimentos para destinatário
    await tx.clienteAtendimento.createMany({
      data: clientesAlvo.map((c) => ({
        clienteId: c.id,
        memberId: destino.id,
        inicioEm: now,
        motivo: motivo ?? 'transferencia',
        observacao: observacao ?? null,
      })),
    })

    // 3. Atualiza responsavelId
    await tx.cliente.updateMany({
      where: { id: { in: clientesAlvo.map((c) => c.id) } },
      data: { responsavelId: destino.id },
    })

    return clientesAlvo.length
  })

  return NextResponse.json({
    ok: true,
    transferidos: result,
    origem: {
      id: origem.id,
      nome: origem.user?.nome ?? origem.email,
    },
    destino: {
      id: destino.id,
      nome: destino.user?.nome ?? destino.email,
    },
  })
}
