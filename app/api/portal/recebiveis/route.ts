/**
 * GET /api/portal/recebiveis
 * Lista boletos do cliente logado com info para download e cópia.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const scope = await requirePortal()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const boletos = await db.boleto.findMany({
    where: { clienteId: scope.clienteId, workspaceId: scope.workspaceId },
    orderBy: { vencimento: 'desc' },
    take: 200,
    select: {
      id: true,
      numero: true,
      valor: true,
      vencimento: true,
      status: true,
      confirmadoEm: true,
      linkBoleto: true,
      banco: true,
      contratoIdFk: true,
      contrato: { select: { numero: true } },
    },
  })

  const hoje = new Date()
  const items = boletos.map((b) => {
    const venc = new Date(b.vencimento)
    const vencido = venc < hoje && b.status !== 'pago'
    return {
      id: b.id,
      numero: b.numero,
      valor: Number(b.valor),
      vencimento: b.vencimento,
      status: vencido ? 'vencido' : b.status,
      confirmadoEm: b.confirmadoEm,
      linkBoleto: b.linkBoleto ?? null,
      banco: b.banco,
      contratoNumero: b.contrato?.numero ?? null,
    }
  })

  const totalAberto = items
    .filter((b) => b.status !== 'pago')
    .reduce((s, b) => s + b.valor, 0)
  const totalVencido = items
    .filter((b) => b.status === 'vencido')
    .reduce((s, b) => s + b.valor, 0)
  const totalPago = items
    .filter((b) => b.status === 'pago')
    .reduce((s, b) => s + b.valor, 0)

  return NextResponse.json({
    ok: true,
    boletos: items,
    resumo: { totalAberto, totalVencido, totalPago },
  })
}
