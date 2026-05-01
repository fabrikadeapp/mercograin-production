import { db } from '@/lib/db'
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userId = session.user.id

    // Datas para cálculos
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // 1. Clientes
    const clientesTotal = await db.cliente.count({
      where: { usuarioId: userId },
    })

    const clientesAtivos = await db.cliente.count({
      where: { usuarioId: userId, ativo: true },
    })

    // 2. Propostas
    const propostasTotal = await db.proposta.count({
      where: { cliente: { usuarioId: userId } },
    })

    const propostasAbertas = await db.proposta.count({
      where: {
        cliente: { usuarioId: userId },
        status: 'rascunho',
      },
    })

    // Valor total de propostas aceitas
    const propostasAceitas = await db.proposta.findMany({
      where: {
        cliente: { usuarioId: userId },
        status: 'aceita',
      },
      select: { valorTotal: true },
    })

    const propostasAceitasValor = propostasAceitas
      .reduce((sum, p) => sum + parseFloat(p.valorTotal as any), 0)
      .toString()

    // 3. Boletos
    const boletosTotal = await db.boleto.count({
      where: { cliente: { usuarioId: userId } },
    })

    const boletosPagos = await db.boleto.count({
      where: { cliente: { usuarioId: userId }, status: 'pago' },
    })

    const boletosAbertos = await db.boleto.count({
      where: { cliente: { usuarioId: userId }, status: 'aberto' },
    })

    const boletosVencidos = await db.boleto.count({
      where: {
        cliente: { usuarioId: userId },
        status: 'vencido',
      },
    })

    // Valores dos boletos
    const boletosPagosData = await db.boleto.findMany({
      where: { cliente: { usuarioId: userId }, status: 'pago' },
      select: { valor: true },
    })

    const boletosValorPago = boletosPagosData
      .reduce((sum, b) => sum + parseFloat(b.valor as any), 0)
      .toString()

    const boletosAllData = await db.boleto.findMany({
      where: { cliente: { usuarioId: userId } },
      select: { valor: true },
    })

    const boletosValorTotal = boletosAllData
      .reduce((sum, b) => sum + parseFloat(b.valor as any), 0)
      .toString()

    // 4. Receita
    // Receita 24h: boletos pagos nos últimos 24h
    const boletos24h = await db.boleto.findMany({
      where: {
        cliente: { usuarioId: userId },
        status: 'pago',
        confirmadoEm: { gte: oneDayAgo },
      },
      select: { valor: true },
    })

    const receita24h = boletos24h
      .reduce((sum, b) => sum + parseFloat(b.valor as any), 0)
      .toString()

    // Receita 30d: boletos pagos nos últimos 30 dias
    const boletos30d = await db.boleto.findMany({
      where: {
        cliente: { usuarioId: userId },
        status: 'pago',
        confirmadoEm: { gte: thirtyDaysAgo },
      },
      select: { valor: true },
    })

    const receita30d = boletos30d
      .reduce((sum, b) => sum + parseFloat(b.valor as any), 0)
      .toString()

    return NextResponse.json({
      clientesTotal,
      clientesAtivos,
      propostasTotal,
      propostasAbertas,
      propostasAceitasValor,
      boletosTotal,
      boletosPagos,
      boletosAbertos,
      boletosVencidos,
      boletosValorTotal,
      boletosValorPago,
      receita24h,
      receita30d,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular estatísticas' },
      { status: 500 }
    )
  }
}
