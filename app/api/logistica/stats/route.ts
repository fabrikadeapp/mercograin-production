import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const trintaDiasAtras = new Date()
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30)

    const [agendadas, emTransito, entregues30d, agg, capacidadeArmazens, ordensRecentes] =
      await Promise.all([
        db.ordemCarga.count({ where: scope.whereOwn({ status: 'agendada' }) }),
        db.ordemCarga.count({ where: scope.whereOwn({ status: 'em_transito' }) }),
        db.ordemCarga.count({
          where: scope.whereOwn({
            status: 'entregue',
            dataDescarga: { gte: trintaDiasAtras },
          }),
        }),
        db.ordemCarga.aggregate({
          where: scope.whereOwn({ status: { in: ['agendada', 'em_transito'] } }),
          _sum: { quantidadeSc: true },
        }),
        db.armazem.aggregate({
          where: scope.whereOwn({ ativo: true }),
          _sum: { capacidadeSc: true },
        }),
        db.ordemCarga.findMany({
          where: scope.whereOwn(),
          orderBy: { updatedAt: 'desc' },
          take: 5,
          include: {
            motorista: { select: { id: true, nome: true } },
            transportadora: { select: { id: true, razaoSocial: true } },
          },
        }),
      ])

    return NextResponse.json({
      agendadas,
      emTransito,
      entregues30d,
      totalSc: agg._sum.quantidadeSc ?? 0,
      capacidadeArmazens: capacidadeArmazens._sum.capacidadeSc ?? 0,
      ordensRecentes,
    })
  } catch (error) {
    console.error('Get stats logistica error:', error)
    return NextResponse.json({ error: 'Erro ao buscar stats' }, { status: 500 })
  }
}
