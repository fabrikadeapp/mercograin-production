import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

/**
 * GET /api/equipe/{memberId}/performance?periodo=mes|trim|ano
 *
 * Retorna métricas de um colaborador:
 *  - clientesAtivos: nº de clientes onde é responsável atual
 *  - propostasCriadas + valorTotal: período
 *  - contratosFechados + gmv: período
 *  - taxaConversao: contratos / propostas
 *  - ticketMedio: gmv / contratos
 *
 * Gate: owner/admin do workspace (ou admin global).
 */
export async function GET(
  req: Request,
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
    // Permite que o próprio colaborador veja sua performance
    const ownMembership = await db.workspaceMember.findFirst({
      where: { id: params.memberId, userId: scope.userId },
      select: { id: true },
    })
    if (!ownMembership) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const url = new URL(req.url)
  const periodo = (url.searchParams.get('periodo') ?? 'mes') as
    | 'mes'
    | 'trim'
    | 'ano'

  const now = new Date()
  const inicio = new Date(now)
  if (periodo === 'mes') inicio.setMonth(inicio.getMonth() - 1)
  else if (periodo === 'trim') inicio.setMonth(inicio.getMonth() - 3)
  else inicio.setFullYear(inicio.getFullYear() - 1)

  const member = await db.workspaceMember.findFirst({
    where: { id: params.memberId, workspaceId: scope.workspaceId },
    select: {
      id: true,
      email: true,
      cargo: true,
      funcoes: true,
      areasPermitidas: true,
      role: true,
      user: { select: { nome: true, email: true } },
    },
  })
  if (!member) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const [clientesAtivos, propostasAgg, contratosAgg] = await Promise.all([
    db.cliente.count({
      where: { workspaceId: scope.workspaceId, responsavelId: member.id, ativo: true },
    }),
    db.proposta.aggregate({
      where: {
        workspaceId: scope.workspaceId,
        criadaEm: { gte: inicio },
        OR: [
          { vendedorId: member.id },
          { gerenteContaId: member.id },
        ],
      },
      _count: { _all: true },
      _sum: { valorTotal: true },
    }),
    db.contrato.aggregate({
      where: {
        workspaceId: scope.workspaceId,
        criadoEm: { gte: inicio },
        OR: [
          { vendedorId: member.id },
          { gerenteContaId: member.id },
        ],
      },
      _count: { _all: true },
    }),
  ])

  // GMV = soma dos valorTotal das propostas que viraram contratos
  const contratosComProposta = await db.contrato.findMany({
    where: {
      workspaceId: scope.workspaceId,
      criadoEm: { gte: inicio },
      OR: [{ vendedorId: member.id }, { gerenteContaId: member.id }],
    },
    select: { proposta: { select: { valorTotal: true } } },
  })
  const gmv = contratosComProposta.reduce(
    (acc, c) => acc + Number(c.proposta?.valorTotal ?? 0),
    0,
  )

  const propostasCount = propostasAgg._count._all ?? 0
  const contratosCount = contratosAgg._count._all ?? 0
  const taxaConversao = propostasCount > 0 ? contratosCount / propostasCount : 0
  const ticketMedio = contratosCount > 0 ? gmv / contratosCount : 0

  return NextResponse.json({
    member: {
      id: member.id,
      nome: member.user?.nome ?? member.email,
      email: member.email,
      cargo: member.cargo,
      funcoes: member.funcoes,
      role: member.role,
      areasPermitidas: member.areasPermitidas,
    },
    periodo,
    inicio: inicio.toISOString(),
    fim: now.toISOString(),
    metricas: {
      clientesAtivos,
      propostasCriadas: propostasCount,
      valorPropostas: Number(propostasAgg._sum.valorTotal ?? 0),
      contratosFechados: contratosCount,
      gmv,
      taxaConversao,
      ticketMedio,
    },
  })
}
