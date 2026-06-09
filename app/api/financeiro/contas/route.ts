/**
 * GET /api/financeiro/contas?tipo=receita|despesa
 *
 * Contas a Receber (tipo=receita) ou a Pagar (tipo=despesa), agregando
 * MovimentoFinanceiro em aberto (conciliado=false). Para receber, soma também
 * boletos em aberto. Agrupa por situação de vencimento.
 *
 * Retorno: {
 *   ok, tipo, totais: { aberto, vencido, aVencer, total },
 *   itens: [{ id, descricao, valor, data, vencido, fonte, cliente?, conciliado }]
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const tipo = searchParams.get('tipo') === 'despesa' ? 'despesa' : 'receita'

  const movimentos = await db.movimentoFinanceiro.findMany({
    where: scope.whereOwn({ tipo, conciliado: false }),
    orderBy: { data: 'asc' },
    take: 300,
    select: {
      id: true,
      descricao: true,
      valor: true,
      data: true,
      natureza: true,
      contrato: { select: { numero: true, cliente: { select: { nome: true } } } },
    },
  })

  const now = Date.now()
  let vencido = 0
  let aVencer = 0
  const itens = movimentos.map((m) => {
    const valor = Number(m.valor)
    const isVencido = m.data.getTime() < now
    if (isVencido) vencido += valor
    else aVencer += valor
    return {
      id: m.id,
      descricao: m.descricao,
      valor,
      data: m.data.toISOString(),
      vencido: isVencido,
      fonte: m.natureza || 'lançamento',
      cliente: m.contrato?.cliente?.nome ?? null,
      contrato: m.contrato?.numero ?? null,
    }
  })

  // Para "a receber", inclui boletos em aberto que ainda não viraram movimento.
  if (tipo === 'receita') {
    const boletos = await db.boleto.findMany({
      where: scope.whereOwn({ status: 'aberto' }),
      orderBy: { vencimento: 'asc' },
      take: 200,
      select: {
        id: true,
        valor: true,
        vencimento: true,
        cliente: { select: { nome: true } },
      },
    })
    for (const b of boletos) {
      const valor = Number(b.valor)
      const venc = b.vencimento ? new Date(b.vencimento) : null
      const isVencido = venc ? venc.getTime() < now : false
      if (isVencido) vencido += valor
      else aVencer += valor
      itens.push({
        id: `boleto-${b.id}`,
        descricao: `Boleto · ${b.cliente?.nome ?? 'Cliente'}`,
        valor,
        data: (venc ?? new Date()).toISOString(),
        vencido: isVencido,
        fonte: 'boleto',
        cliente: b.cliente?.nome ?? null,
        contrato: null,
      })
    }
  }

  itens.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
  const total = vencido + aVencer

  return NextResponse.json({
    ok: true,
    tipo,
    totais: { vencido, aVencer, total, aberto: total },
    itens,
  })
}
