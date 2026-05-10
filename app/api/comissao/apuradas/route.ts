import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const corretorId = searchParams.get('corretorId')
  const mesaId = searchParams.get('mesaId')
  const where: any = scope.whereOwn()
  if (status) where.status = status
  if (corretorId) where.corretorId = corretorId
  if (mesaId) where.mesaId = mesaId
  const data = await db.comissaoApurada.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      regra: { select: { id: true, nome: true } },
    },
  })
  // Totalizadores
  const total = data.reduce(
    (acc, c) => {
      acc.contratos++
      acc.valorTotal += Number(c.valorTotalComissao)
      acc.valorCorretor += Number(c.valorCorretor)
      acc.valorOriginador += Number(c.valorOriginador)
      acc.valorMesa += Number(c.valorMesa)
      acc.valorHouse += Number(c.valorHouse)
      return acc
    },
    {
      contratos: 0,
      valorTotal: 0,
      valorCorretor: 0,
      valorOriginador: 0,
      valorMesa: 0,
      valorHouse: 0,
    }
  )
  return NextResponse.json({ data, total })
}
