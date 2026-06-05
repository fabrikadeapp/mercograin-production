/**
 * POST /api/solicitacoes/[id]/converter
 * Body: { preco: number, validadeEm?: ISO, observacao?: string }
 *
 * Converte uma SolicitacaoCotacao em Proposta (status 'rascunho') vinculada
 * ao mesmo cliente. Marca a solicitação como 'convertida'.
 *
 * Cotação atual: o preço cruzado pelo corretor é o `preco` informado (já
 * traz preço final por t/sc). Subtotal = quantidade * preco.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { nextNumber } from '@/lib/numbering/next-number'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  preco: z.number().positive(),
  validadeEm: z.string().datetime().optional(),
  observacao: z.string().max(2000).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'invalid' }, { status: 400 })
  }
  const sol = await db.solicitacaoCotacao.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!sol) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (sol.status === 'convertida') {
    return NextResponse.json({ error: 'ja_convertida', propostaId: sol.propostaId }, { status: 409 })
  }
  if (sol.status === 'recusada' || sol.status === 'cancelada') {
    return NextResponse.json({ error: 'estado_invalido', status: sol.status }, { status: 409 })
  }

  const cliente = await db.cliente.findFirst({
    where: { id: sol.clienteId, ...scope.whereOwn() },
    select: { id: true, responsavelId: true },
  })
  if (!cliente) return NextResponse.json({ error: 'cliente_nao_encontrado' }, { status: 404 })

  const quantidade = Number(sol.quantidade)
  const preco = parsed.data.preco
  const subtotal = quantidade * preco

  const member = await db.workspaceMember.findFirst({
    where: { workspaceId: scope.workspaceId, userId: scope.userId },
    select: { id: true },
  })
  const numero = await nextNumber(scope.workspaceId, 'proposta')
  const validadeEm = parsed.data.validadeEm
    ? new Date(parsed.data.validadeEm)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const proposta = await db.proposta.create({
    data: {
      numero,
      clienteId: sol.clienteId,
      workspaceId: scope.workspaceId,
      tipo: sol.tipo,
      graos: [
        {
          grao: sol.grao,
          quantidade,
          unidade: sol.unidade,
          preco,
          subtotal,
        },
      ],
      valorTotal: String(subtotal),
      status: 'rascunho',
      descricao: parsed.data.observacao ?? sol.observacao ?? undefined,
      validadeEm,
      vendedorId: member?.id ?? null,
      gerenteContaId: cliente.responsavelId ?? member?.id ?? null,
      canalAutorizacao: 'web',
      origem: 'portal_solicitacao',
      localEntrega: sol.localEntrega ?? null,
      validadeCotacao: validadeEm,
    },
  })

  await db.solicitacaoCotacao.update({
    where: { id: sol.id },
    data: {
      status: 'convertida',
      propostaId: proposta.id,
      respondidoPorId: scope.userId,
      respondidoEm: new Date(),
    },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'convert',
    entidade: 'SolicitacaoCotacao',
    entidadeId: sol.id,
    mudancas: { propostaId: proposta.id, preco, subtotal },
  }).catch(() => undefined)

  return NextResponse.json({ ok: true, propostaId: proposta.id, numero: proposta.numero })
}
