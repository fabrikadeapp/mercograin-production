/**
 * DRE agrupado por Mesa.
 *
 * Para cada Mesa do workspace:
 *   - receitaContratos: soma valor proposta dos contratos assinados com mesaId
 *   - comissaoApurada: soma valorTotalComissao das ComissaoApurada
 *   - despesasOutras: soma MovimentoFinanceiro tipo=despesa onde contrato.mesaId = mesa
 *   - resultado: receita - comissao - despesas
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const inicio = searchParams.get('inicio')
  const fim = searchParams.get('fim')
  const dataFiltro: any = {}
  if (inicio) dataFiltro.gte = new Date(inicio)
  if (fim) dataFiltro.lte = new Date(fim)

  const mesas = await db.mesa.findMany({
    where: scope.whereOwn(),
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })

  type Row = {
    mesaId: string | null
    mesaNome: string
    contratos: number
    receita: number
    comissao: number
    despesas: number
    resultado: number
  }

  const rows: Row[] = []
  const sem: Row = {
    mesaId: null,
    mesaNome: '(sem mesa)',
    contratos: 0,
    receita: 0,
    comissao: 0,
    despesas: 0,
    resultado: 0,
  }

  // Carrega contratos assinados do workspace no período
  const whereContrato: any = scope.whereOwn({ statusAssinatura: 'assinado' })
  if (Object.keys(dataFiltro).length) whereContrato.assinadoEm = dataFiltro

  const contratos = await db.contrato.findMany({
    where: whereContrato,
    select: {
      id: true,
      mesaId: true,
      proposta: { select: { valorTotal: true } },
    },
  })

  const contratosPorMesa = new Map<string | null, { qtd: number; receita: number }>()
  for (const c of contratos) {
    const k = c.mesaId
    const cur = contratosPorMesa.get(k) ?? { qtd: 0, receita: 0 }
    cur.qtd++
    cur.receita += Number(c.proposta?.valorTotal ?? 0)
    contratosPorMesa.set(k, cur)
  }

  // Comissões apuradas por mesa
  const whereCom: any = scope.whereOwn()
  if (Object.keys(dataFiltro).length) whereCom.createdAt = dataFiltro
  const comissoes = await db.comissaoApurada.findMany({
    where: whereCom,
    select: { mesaId: true, valorTotalComissao: true },
  })
  const comPorMesa = new Map<string | null, number>()
  for (const c of comissoes) {
    const cur = comPorMesa.get(c.mesaId ?? null) ?? 0
    comPorMesa.set(c.mesaId ?? null, cur + Number(c.valorTotalComissao))
  }

  // Outras despesas (excl. natureza=comissao para evitar dupla contagem) ligadas a contratos
  const whereMov: any = scope.whereOwn({ tipo: 'despesa' })
  if (Object.keys(dataFiltro).length) whereMov.data = dataFiltro
  const movs = await db.movimentoFinanceiro.findMany({
    where: whereMov,
    select: {
      valor: true,
      natureza: true,
      contratoId: true,
      contrato: { select: { mesaId: true } },
    },
  })
  const despPorMesa = new Map<string | null, number>()
  for (const m of movs) {
    if (m.natureza === 'comissao') continue // já contabilizado
    const mesaId = m.contrato?.mesaId ?? null
    const cur = despPorMesa.get(mesaId) ?? 0
    despPorMesa.set(mesaId, cur + Number(m.valor))
  }

  for (const mesa of mesas) {
    const c = contratosPorMesa.get(mesa.id) ?? { qtd: 0, receita: 0 }
    const co = comPorMesa.get(mesa.id) ?? 0
    const de = despPorMesa.get(mesa.id) ?? 0
    rows.push({
      mesaId: mesa.id,
      mesaNome: mesa.nome,
      contratos: c.qtd,
      receita: Math.round(c.receita * 100) / 100,
      comissao: Math.round(co * 100) / 100,
      despesas: Math.round(de * 100) / 100,
      resultado: Math.round((c.receita - co - de) * 100) / 100,
    })
  }

  const c = contratosPorMesa.get(null) ?? { qtd: 0, receita: 0 }
  sem.contratos = c.qtd
  sem.receita = Math.round(c.receita * 100) / 100
  sem.comissao = Math.round((comPorMesa.get(null) ?? 0) * 100) / 100
  sem.despesas = Math.round((despPorMesa.get(null) ?? 0) * 100) / 100
  sem.resultado = Math.round((sem.receita - sem.comissao - sem.despesas) * 100) / 100
  if (sem.contratos > 0 || sem.despesas > 0 || sem.comissao > 0) rows.push(sem)

  const totais = rows.reduce(
    (acc, r) => {
      acc.contratos += r.contratos
      acc.receita += r.receita
      acc.comissao += r.comissao
      acc.despesas += r.despesas
      acc.resultado += r.resultado
      return acc
    },
    { contratos: 0, receita: 0, comissao: 0, despesas: 0, resultado: 0 }
  )

  return NextResponse.json({
    periodo: { inicio: inicio ?? null, fim: fim ?? null },
    rows,
    totais: {
      contratos: totais.contratos,
      receita: Math.round(totais.receita * 100) / 100,
      comissao: Math.round(totais.comissao * 100) / 100,
      despesas: Math.round(totais.despesas * 100) / 100,
      resultado: Math.round(totais.resultado * 100) / 100,
    },
  })
}
