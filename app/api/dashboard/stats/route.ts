/**
 * GET /api/dashboard/stats
 * Retorna estatísticas para o dashboard
 * Inclui: clientes, propostas, contratos, boletos, receita, etc
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    // Helper "where own" for client-table (uses Cliente.usuarioId)
    const whereCliente: any = scope.whereOwn()
    // For Proposta/Contrato/Boleto we filter by their own usuarioId (Multi-tenancy direct).
    const whereOwn: any = scope.whereOwn()

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
        where: whereCliente,
      }),
      // Propostas total
      db.proposta.count({
        where: whereOwn,
      }),
      // Propostas por status
      db.proposta.groupBy({
        by: ['status'],
        where: whereOwn,
        _count: true,
      }),
      // Contratos total
      db.contrato.count({
        where: whereOwn,
      }),
      // Contratos por status
      db.contrato.groupBy({
        by: ['statusAssinatura'],
        where: whereOwn,
        _count: true,
      }),
      // Boletos total
      db.boleto.count({
        where: whereOwn,
      }),
      // Boletos por status
      db.boleto.groupBy({
        by: ['status'],
        where: whereOwn,
        _count: true,
      }),
      // Arrecadação (boletos pagos)
      db.boleto.aggregate({
        where: {
          ...whereOwn,
          status: 'pago',
        },
        _sum: { valor: true },
      }),
      // Últimas 5 propostas
      db.proposta.findMany({
        where: whereOwn,
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
        where: whereOwn,
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
        where: whereOwn,
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
      where: whereOwn,
      _sum: { valorTotal: true },
    })

    // Calcular valores de boletos abertos
    const boletosAbertosValor = await db.boleto.aggregate({
      where: {
        ...whereOwn,
        status: { in: ['aberto', 'vencido'] },
      },
      _sum: { valor: true },
    })

    // Alertas: Boletos vencidos
    const boletosVencidos = await db.boleto.findMany({
      where: {
        ...whereOwn,
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
        ...whereOwn,
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

    // Sparklines 12 meses (contratos por mês)
    const ago12 = new Date()
    ago12.setMonth(ago12.getMonth() - 12)
    const contratosMes = await db.contrato.findMany({
      where: { ...whereOwn, criadoEm: { gte: ago12 } },
      select: { criadoEm: true, statusAssinatura: true },
    })
    const sparkBuckets: Record<string, { emitidos: number; assinados: number; fechados: number }> = {}
    for (let i = 0; i < 12; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() - (11 - i))
      const key = `${d.getFullYear()}-${d.getMonth()}`
      sparkBuckets[key] = { emitidos: 0, assinados: 0, fechados: 0 }
    }
    for (const c of contratosMes) {
      const k = `${c.criadoEm.getFullYear()}-${c.criadoEm.getMonth()}`
      if (sparkBuckets[k]) {
        sparkBuckets[k].emitidos++
        if (c.statusAssinatura === 'assinado') sparkBuckets[k].assinados++
      }
    }
    const sparkEmitidos = Object.values(sparkBuckets).map((b) => b.emitidos)
    const sparkAssinados = Object.values(sparkBuckets).map((b) => b.assinados)

    // Tonelagem total comprada (soma sacas em propostas aceitas tipo=compra)
    const propostasCompras = await db.proposta.findMany({
      where: { ...whereOwn, status: 'aceita', tipo: 'compra' },
      select: { graos: true },
    })
    let tonsCompradas = 0
    for (const p of propostasCompras) {
      const arr = Array.isArray(p.graos) ? (p.graos as any[]) : []
      for (const g of arr) tonsCompradas += Number(g?.quantidade || 0) * 0.06
    }

    return NextResponse.json({
      summary: {
        clientes: clientesTotal,
        propostas: propostasTotal,
        contratos: contratosTotal,
        boletos: boletosTotal,
      },
      kpis: {
        contatosFeitos: clientesTotal,
        contratosEmitidos: contratosTotal,
        contratosAssinados: contratosPorStatusMap['assinado'] || 0,
        contratosFechados: contratosPorStatusMap['fechado'] || 0,
        tonsCompradas: Math.round(tonsCompradas),
      },
      sparklines: {
        emitidos: sparkEmitidos,
        assinados: sparkAssinados,
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
