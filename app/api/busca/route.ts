import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const ownClient: any = scope.whereOwn()
    const ownDirect: any = scope.whereOwn()

    const query = searchParams.get('q') || ''

    if (query.length < 2) {
      return NextResponse.json({
        clientes: [],
        propostas: [],
        contratos: [],
        boletos: [],
      })
    }

    // Buscar em paralelo
    const [clientes, propostas, contratos, boletos] = await Promise.all([
      // Buscar clientes
      db.cliente.findMany({
        where: {
          ...ownClient,
          OR: [
            { nome: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { cnpj: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          nome: true,
          email: true,
          tipo: true,
        },
        take: 5,
      }),

      // Buscar propostas
      db.proposta.findMany({
        where: {
          ...ownDirect,
          OR: [
            { numero: { contains: query, mode: 'insensitive' } },
            { cliente: { nome: { contains: query, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          numero: true,
          status: true,
          cliente: { select: { nome: true } },
        },
        take: 5,
      }),

      // Buscar contratos
      db.contrato.findMany({
        where: {
          ...ownDirect,
          OR: [
            { numero: { contains: query, mode: 'insensitive' } },
            { cliente: { nome: { contains: query, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          numero: true,
          statusAssinatura: true,
          cliente: { select: { nome: true } },
        },
        take: 5,
      }),

      // Buscar boletos
      db.boleto.findMany({
        where: {
          ...ownDirect,
          OR: [
            { numero: { contains: query, mode: 'insensitive' } },
            { cliente: { nome: { contains: query, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          numero: true,
          status: true,
          valor: true,
          cliente: { select: { nome: true } },
        },
        take: 5,
      }),
    ])

    return NextResponse.json({
      clientes,
      propostas,
      contratos,
      boletos,
      query,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar' },
      { status: 500 }
    )
  }
}
