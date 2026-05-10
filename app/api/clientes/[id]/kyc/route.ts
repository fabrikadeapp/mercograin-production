/**
 * S4 M1 — Endpoint unificado de KYC.
 *
 * POST /api/clientes/[id]/kyc
 *   Roda todas as verificações de compliance em paralelo e persiste resultado.
 *
 * GET /api/clientes/[id]/kyc
 *   Retorna o último resultado armazenado (sem re-rodar).
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { rodarKyc, type KycResultado } from '@/lib/compliance/kyc'
import { logAudit } from '@/lib/audit/log'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const cliente = await db.cliente.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    select: {
      id: true,
      nome: true,
      cpf: true,
      cnpj: true,
      kycResultado: true,
      kycRodadoEm: true,
      kycStatus: true,
    },
  })

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  return NextResponse.json(cliente)
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const cliente = await db.cliente.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  const propriedades = await db.propriedadeRural.findMany({
    where: { workspaceId: scope.workspaceId, produtorId: cliente.id, ativo: true },
    select: { id: true, nome: true, car: true },
  })

  let resultado: KycResultado
  try {
    resultado = await rodarKyc(
      { id: cliente.id, nome: cliente.nome, cpf: cliente.cpf, cnpj: cliente.cnpj },
      propriedades.map((p) => ({ id: p.id, nome: p.nome, car: p.car })),
    )
  } catch (e: any) {
    console.error('[KYC] Erro ao rodar:', e)
    return NextResponse.json({ error: 'Falha ao rodar KYC', detail: e?.message }, { status: 500 })
  }

  await db.cliente.update({
    where: { id: cliente.id },
    data: {
      kycResultado: resultado as any,
      kycRodadoEm: new Date(resultado.rodadoEm),
      kycStatus: resultado.status,
    },
  })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'kyc',
    entidade: 'cliente',
    entidadeId: cliente.id,
    mudancas: { status: resultado.status, alertas: resultado.alertas.length },
  })

  return NextResponse.json(resultado)
}
