/**
 * GET /api/dashboard/stats
 * Retorna estatísticas para o dashboard
 * Inclui: clientes, propostas, contratos, boletos, receita, etc
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar todas as estatísticas em paralelo
    const [
      clientesTotal,
      propostasTotal,
      propostasPorStatus,
      contratosTotal,
      contratoPorStatus,
      boletosTotal,
      boletoPorStatus,
      arrecadacao,
      ultimasPropostas,
      ultimosContratos,
      ultimosBoletos,
    ] = await Promise.all([
      // Clientes
      db.cliente.count({
        where: { usuarioId: session.user.id },
      }),
      // Propostas total
      db.proposta.count({
        where: { cliente: { usuarioId: session.user.id } },
      }),
      // Propostas por status
      db.proposta.groupBy({
        by: ['status'],
        where: { cliente: { usuarioId: session.user.id } },
        _count: true,
      }),
      // Contratos total
      db.contrato.count({
        where: { cliente: { usuarioId: session.user.id } },
      }),
      // Contratos por status
      db.contrato.groupBy({
        by: ['statusAssinatura'],
        where: { cliente: { usuarioId: session.user.id } },
        _count: true,
      }),
      // Boletos total
      db.boleto.count({
        where: { cliente: { usuarioId: session.user.id } },
      }),
      // Boletos por status
      db.boleto.groupBy({
        by: ['status'],
        where: { cliente: { usuarioId: session.user.id } },
        _count: true,
      }),
      // Arrecadação (boletos pagos)
      db.boleto.aggregate({
        where: {
          cliente: { usuarioId: session.user.id },
          status: 'pago',
        },
        _sum: { valor: true },
      }),
      // Últimas 5 propostas
      db.proposta.findMany({
        where: { cliente: { usuarioId: session.user.id } },
        select: {
          id: true,
          numero: true,
          status: true,
          valorTotal: true,
          criadaEm: true,
          cliente: { select: { nome: true } },
        },
        orderBy: { criadaEm: 'desc' },
        take: 5,
      }),
      // Últimos 5 contratos
      db.contrato.findMany({
        where: { cliente: { usuarioId: session.user.id } },
        select: {
          id: true,
          numero: true,
          statusAssinatura: true,
          criadoEm: true,
          proposta: { select: { numero: true } },
          cliente: { select: { nome: true } },
        },
        orderBy: { criadoEm: 'desc' },
        take: 5,
      }),
      // Últimos 5 boletos
      db.boleto.findMany({
        where: { cliente: { usuarioId: session.user.id } },
        select: {
          id: true,
          numero: true,
          valor: true,
          status: true,
          vencimento: true,
          criadoEm: true,
          cliente: { select: { nome: true } },
        },
        orderBy: { criadoEm: 'desc' },
        take: 5,
      }),
    ])

    // Processar status de propostas
    const propostasPorStatusMap = propostasPorStatus.reduce(
      (acc: any, item: any) => {
        acc[item.status] = item._count
        return acc
      },
      {}
    )

    // Processar status de contratos
    const contratosPorStatusMap = contratoPorStatus.reduce(
      (acc: any, item: any) => {
        acc[item.statusAssinatura] = item._count
        return acc
      },
      {}
    )

    // Processar status de boletos
    const boletosPorStatusMap = boletoPorStatus.reduce(
      (acc: any, item: any) => {
        acc[item.status] = item._count
        return acc
      },
      {}
    )

    // Calcular valores de propostas
    const propostasValor = await db.proposta.aggregate({
      where: { cliente: { usuarioId: session.user.id } },
      _sum: { valorTotal: true },
    })

    // Calcular valores de boletos abertos
    const boletosAbertosValor = await db.boleto.aggregate({
      where: {
        cliente: { usuarioId: session.user.id },
        status: { in: ['aberto', 'vencido'] },
      },
      _sum: { valor: true },
    })

    // Alertas: Boletos vencidos
    const boletosVencidos = await db.boleto.findMany({
      where: {
        cliente: { usuarioId: session.user.id },
        status: 'vencido',
      },
      select: {
        id: true,
        numero: true,
        valor: true,
        vencimento: true,
        cliente: { select: { nome: true } },
      },
      orderBy: { vencimento: 'asc' },
      take: 5,
    })

    // Alertas: Propostas pendentes
    const propostasPendentes = await db.proposta.findMany({
      where: {
        cliente: { usuarioId: session.user.id },
        status: 'enviada',
      },
      select: {
        id: true,
        numero: true,
        cliente: { select: { nome: true } },
        validadeEm: true,
      },
      orderBy: { validadeEm: 'asc' },
      take: 5,
    })

    return NextResponse.json({
      summary: {
        clientes: clientesTotal,
        propostas: propostasTotal,
        contratos: contratosTotal,
        boletos: boletosTotal,
      },
      propostas: {
        total: propostasTotal,
        porStatus: propostasPorStatusMap,
        valorTotal: propostasValor._sum.valorTotal || 0,
      },
      contratos: {
        total: contratosTotal,
        porStatus: contratosPorStatusMap,
      },
      boletos: {
        total: boletosTotal,
        porStatus: boletosPorStatusMap,
        arrecadado: arrecadacao._sum.valor || 0,
        aberto: boletosAbertosValor._sum.valor || 0,
      },
      activity: {
        ultimasPropostas: ultimasPropostas.map((p: any) => ({
          id: p.id,
          numero: p.numero,
          cliente: p.cliente.nome,
          status: p.status,
          valor: Number(p.valorTotal),
          data: p.criadaEm,
        })),
        ultimosContratos: ultimosContratos.map((c: any) => ({
          id: c.id,
          numero: c.numero,
          proposta: c.proposta.numero,
          cliente: c.cliente.nome,
          status: c.statusAssinatura,
          data: c.criadoEm,
        })),
        ultimosBoletos: ultimosBoletos.map((b: any) => ({
          id: b.id,
          numero: b.numero,
          cliente: b.cliente.nome,
          valor: Number(b.valor),
          status: b.status,
          vencimento: b.vencimento,
          data: b.criadoEm,
        })),
      },
      alerts: {
        boletosVencidos: boletosVencidos.map((b: any) => ({
          id: b.id,
          numero: b.numero,
          cliente: b.cliente.nome,
          valor: Number(b.valor),
          vencimento: b.vencimento,
        })),
        propostasPendentes: propostasPendentes.map((p: any) => ({
          id: p.id,
          numero: p.numero,
          cliente: p.cliente.nome,
          validadeEm: p.validadeEm,
        })),
      },
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      {
        error: 'Erro ao carregar estatísticas',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
