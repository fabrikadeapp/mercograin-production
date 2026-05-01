import { db } from '@/lib/db'
import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mes = parseInt(searchParams.get('mes') || new Date().getMonth().toString())
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString())

    const dataInicio = new Date(ano, mes, 1)
    const dataFim = new Date(ano, mes + 1, 0)

    // Receita por tipo de grão (propostas)
    const propostasPorGrao = await db.proposta.findMany({
      where: {
        cliente: { usuarioId: session.user.id },
        criadaEm: { gte: dataInicio, lte: dataFim },
        status: 'aceita',
      },
      select: { graos: true, valorTotal: true },
    })

    const graosMap: Record<string, { quantidade: number; valor: number }> = {}
    propostasPorGrao.forEach((p) => {
      const graos = Array.isArray(p.graos) ? p.graos : []
      graos.forEach((g: any) => {
        if (!graosMap[g.grao]) {
          graosMap[g.grao] = { quantidade: 0, valor: 0 }
        }
        graosMap[g.grao].quantidade += g.quantidade || 0
        graosMap[g.grao].valor += g.subtotal || 0
      })
    })

    // Status das propostas
    const propostas = await db.proposta.groupBy({
      by: ['status'],
      where: {
        cliente: { usuarioId: session.user.id },
        criadaEm: { gte: dataInicio, lte: dataFim },
      },
      _count: true,
    })

    const propostasMap: Record<string, number> = {}
    propostas.forEach((p: any) => {
      propostasMap[p.status] = p._count
    })

    // Boletos por status e arrecadação
    const boletos = await db.boleto.groupBy({
      by: ['status'],
      where: {
        cliente: { usuarioId: session.user.id },
        criadoEm: { gte: dataInicio, lte: dataFim },
      },
      _count: true,
      _sum: { valor: true },
    })

    const boletosMap: Record<string, { count: number; valor: number }> = {}
    boletos.forEach((b: any) => {
      boletosMap[b.status] = {
        count: b._count,
        valor: Number(b._sum.valor || 0),
      }
    })

    // Evolução de receita por dia
    const boletosPorDia = await db.boleto.findMany({
      where: {
        cliente: { usuarioId: session.user.id },
        criadoEm: { gte: dataInicio, lte: dataFim },
        status: 'pago',
      },
      select: { valor: true, criadoEm: true },
    })

    const recebeAPorDia: Record<number, number> = {}
    boletosPorDia.forEach((b) => {
      const dia = new Date(b.criadoEm).getDate()
      recebeAPorDia[dia] = (recebeAPorDia[dia] || 0) + Number(b.valor)
    })

    // Clientes mais ativos
    const clientesAtivos = await db.proposta.groupBy({
      by: ['clienteId'],
      where: {
        cliente: { usuarioId: session.user.id },
        criadaEm: { gte: dataInicio, lte: dataFim },
      },
      _count: true,
      _sum: { valorTotal: true },
      orderBy: { _sum: { valorTotal: 'desc' } },
      take: 5,
    })

    const clientesComNomes = await Promise.all(
      clientesAtivos.map(async (c: any) => {
        const cliente = await db.cliente.findUnique({
          where: { id: c.clienteId },
          select: { nome: true },
        })
        return {
          nome: cliente?.nome || 'Desconhecido',
          propostas: c._count,
          valor: Number(c._sum.valorTotal || 0),
        }
      })
    )

    return NextResponse.json({
      periodo: {
        mes,
        ano,
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
      },
      graos: Object.entries(graosMap).map(([grao, dados]) => ({
        grao,
        quantidade: dados.quantidade,
        valor: dados.valor,
      })),
      propostas: propostasMap,
      boletos: boletosMap,
      recebeAPorDia: Object.entries(recebeAPorDia).map(([dia, valor]) => ({
        dia: parseInt(dia),
        valor,
      })),
      clientesAtivos: clientesComNomes,
    })
  } catch (error) {
    console.error('Relatorio error:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar relatório' },
      { status: 500 }
    )
  }
}
