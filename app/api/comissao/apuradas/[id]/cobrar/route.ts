import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const schema = z.object({
  /** Quem está sendo cobrado: 'corretor' | 'cliente' | 'fornecedor' */
  destinatarioTipo: z.enum(['corretor', 'cliente', 'fornecedor']).default('corretor'),
  destinatarioId: z.string().optional(),
  /** Vencimento — default: hoje + 7 dias */
  vencimento: z.string().optional(),
  banco: z.string().default('001'),
  observacao: z.string().optional(),
})

/**
 * POST /api/comissao/apuradas/{id}/cobrar
 *
 * Gera um boleto a partir de uma comissão apurada. Útil quando a corretora
 * precisa repassar a comissão (ex.: house cobra corretor parceiro) ou
 * documenta cobrança de forma rastreável.
 *
 * Cria um Boleto vinculado ao contratoId da comissão, com valor = valorCorretor
 * por padrão.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
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

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'invalid' },
      { status: 400 },
    )
  }

  const comissao = await db.comissaoApurada.findFirst({
    where: { id: params.id, workspaceId: scope.workspaceId },
    include: {
      regra: { select: { nome: true } },
    },
  })
  if (!comissao) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Para cobrar, contrato precisa existir
  const contrato = await db.contrato.findFirst({
    where: { id: comissao.contratoId, workspaceId: scope.workspaceId },
    include: { cliente: { select: { id: true, nome: true } } },
  })
  if (!contrato) {
    return NextResponse.json({ error: 'contrato_invalido' }, { status: 400 })
  }

  // Valor: se destinatario=corretor, usa valorCorretor. Senão valorTotal.
  const valor =
    parsed.data.destinatarioTipo === 'corretor'
      ? Number(comissao.valorCorretor)
      : Number(comissao.valorTotalComissao)

  if (valor <= 0) {
    return NextResponse.json(
      { error: 'valor_zerado' },
      { status: 400 },
    )
  }

  const vencimento = parsed.data.vencimento
    ? new Date(parsed.data.vencimento)
    : new Date(Date.now() + 7 * 24 * 3600 * 1000)

  // Geração de número simples
  const ts = Date.now().toString().slice(-8)
  const numero = `COM-${ts}`

  const boleto = await db.boleto.create({
    data: {
      numero,
      clienteId: contrato.clienteId,
      contratoIdFk: contrato.id,
      workspaceId: scope.workspaceId,
      banco: parsed.data.banco,
      valor: String(valor),
      vencimento,
      status: 'aberto',
    },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'comissao_cobranca_emitida',
    entidade: 'boleto',
    entidadeId: boleto.id,
    mudancas: {
      comissaoId: comissao.id,
      contratoId: contrato.id,
      destinatarioTipo: parsed.data.destinatarioTipo,
      valor,
    },
  }).catch(() => null)

  return NextResponse.json({ ok: true, boleto })
}
