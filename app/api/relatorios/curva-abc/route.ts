import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { calcularCurvaABC } from '@/lib/compliance/curva-abc'

/**
 * GET /api/relatorios/curva-abc?tipo=clientes|fornecedores|produtos
 * Calcula valor a partir de Contrato (via Proposta.valorTotal) ou Boleto.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const tipo = searchParams.get('tipo') || 'clientes'

  if (tipo === 'clientes') {
    const clientes = await db.cliente.findMany({
      where: scope.whereOwn(),
      include: {
        contratos: {
          select: { proposta: { select: { valorTotal: true } } },
        },
      },
    })
    const itens = clientes.map((c) => ({
      id: c.id,
      nome: c.nome,
      total: c.contratos.reduce(
        (s, ct) => s + Number(ct.proposta?.valorTotal || 0),
        0
      ),
    }))
    const curva = calcularCurvaABC(itens, (x) => x.total)
    return NextResponse.json({ tipo, data: curva })
  }

  if (tipo === 'fornecedores') {
    const fornecedores = await db.fornecedor.findMany({
      where: scope.whereOwn(),
      include: {
        royalties: { select: { valorTotal: true } },
      },
    })
    const itens = fornecedores.map((f) => ({
      id: f.id,
      nome: f.razaoSocial,
      total: f.royalties.reduce((s, r) => s + Number(r.valorTotal), 0),
    }))
    const curva = calcularCurvaABC(itens, (x) => x.total)
    return NextResponse.json({ tipo, data: curva })
  }

  if (tipo === 'produtos') {
    // Usa TicketBalanca finalizado agregado por cultura (sacas = kg/60)
    const tickets = await db.ticketBalanca.findMany({
      where: { ...scope.whereOwn(), status: 'finalizado' },
      select: { cultura: true, pesoLiquidoKg: true },
    })
    const map = new Map<string, number>()
    for (const t of tickets) {
      const sacas = (t.pesoLiquidoKg || 0) / 60
      map.set(t.cultura, (map.get(t.cultura) || 0) + sacas)
    }
    const itens = Array.from(map.entries()).map(([cultura, total]) => ({
      id: cultura,
      nome: cultura,
      total,
    }))
    const curva = calcularCurvaABC(itens, (x) => x.total)
    return NextResponse.json({ tipo, data: curva })
  }

  return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
}
