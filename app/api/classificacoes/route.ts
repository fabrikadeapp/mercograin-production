import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  classificarCarga,
  padraoFromTabela,
  Cultura,
} from '@/lib/operacao-fisica/classificacao'

const classifSchema = z.object({
  cultura: z.enum(['soja', 'milho', 'trigo']),
  umidade: z.coerce.number().nonnegative(),
  impureza: z.coerce.number().nonnegative(),
  ardidos: z.coerce.number().nonnegative().optional(),
  quebrados: z.coerce.number().nonnegative().optional(),
  esverdeados: z.coerce.number().nonnegative().optional(),
  pesoHectolitroKg: z.coerce.number().nonnegative().optional(),
  pesoBrutoKg: z.coerce.number().nonnegative(),
  tabelaId: z.string().optional().nullable(),
  ticketBalancaId: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
})

export async function POST(request: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await request.json()
    const data = classifSchema.parse(body)
    let tabela = null
    if (data.tabelaId) {
      tabela = await db.tabelaClassificacao.findFirst({
        where: { id: data.tabelaId, ...scope.whereOwn() },
      })
      if (!tabela) return NextResponse.json({ error: 'Tabela inválida' }, { status: 400 })
    }
    const padrao = padraoFromTabela(
      data.cultura as Cultura,
      tabela
        ? {
            cultura: data.cultura as Cultura,
            umidadePadrao: tabela.umidadePadrao,
            umidadeMaxima: tabela.umidadeMaxima,
            impurezaPadrao: tabela.impurezaPadrao,
            impurezaMaxima: tabela.impurezaMaxima,
            ardidosMaximo: tabela.ardidosMaximo,
            quebradosMaximo: tabela.quebradosMaximo,
            esverdeadosMaximo: tabela.esverdeadosMaximo ?? undefined,
            pesoHectolitroMin: tabela.pesoHectolitroMin ?? undefined,
            fatorDescontoUmidade: tabela.fatorDescontoUmidade,
            fatorDescontoImpureza: tabela.fatorDescontoImpureza,
            fatorDescontoArdidos: tabela.fatorDescontoArdidos,
            fatorDescontoQuebrados: tabela.fatorDescontoQuebrados,
          }
        : undefined
    )
    const result = classificarCarga(
      {
        umidade: data.umidade,
        impureza: data.impureza,
        ardidos: data.ardidos,
        quebrados: data.quebrados,
        esverdeados: data.esverdeados,
        pesoHectolitroKg: data.pesoHectolitroKg,
      },
      padrao,
      data.pesoBrutoKg
    )
    const created = await db.classificacao.create({
      data: {
        workspaceId: scope.workspaceId,
        cultura: data.cultura,
        umidade: data.umidade,
        impureza: data.impureza,
        ardidos: data.ardidos ?? 0,
        quebrados: data.quebrados ?? 0,
        esverdeados: data.esverdeados ?? null,
        pesoHectolitroKg: data.pesoHectolitroKg ?? null,
        tabelaId: data.tabelaId || null,
        descontoUmidadePct: result.descontoUmidadePct,
        descontoImpurezaPct: result.descontoImpurezaPct,
        descontoArdidosPct: result.descontoArdidosPct,
        descontoQuebradosPct: result.descontoQuebradosPct,
        descontoTotalPct: result.descontoTotalPct,
        pesoLiquidoFinalKg: result.pesoLiquidoFinalKg,
        classificadoPor: scope.userId,
        observacoes: data.observacoes || null,
      },
    })
    if (data.ticketBalancaId) {
      await db.ticketBalanca.updateMany({
        where: { id: data.ticketBalancaId, workspaceId: scope.workspaceId },
        data: { classificacaoId: created.id, status: 'classificado' },
      })
    }
    return NextResponse.json({ classificacao: created, alertas: result.alertaForaPadrao }, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    console.error('POST classif error', e)
    return NextResponse.json({ error: 'Erro ao classificar' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const cultura = searchParams.get('cultura') || undefined
  const filters: any = {}
  if (cultura) filters.cultura = cultura
  const data = await db.classificacao.findMany({
    where: scope.whereOwn(filters),
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ data })
}
