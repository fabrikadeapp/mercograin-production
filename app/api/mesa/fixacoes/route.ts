/**
 * GET /api/mesa/fixacoes
 *
 * Fixações de preço pendentes (contratos preço-a-fixar com janela aberta).
 * ContratoFixacao com statusFixacao != 'totalmente_fixado' e != 'cancelado'.
 * Ordena por janela de fixação mais próxima do fim.
 *
 * Retorno: { ok, items: [{ id, contratoId, cliente, resumo, status,
 *            qtdRemanescente, janela, janelaHoras, precoRef, cultura, href }] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const fixacoes = await db.contratoFixacao.findMany({
    where: scope.whereOwn({
      statusFixacao: { notIn: ['totalmente_fixado', 'cancelado'] },
    }),
    orderBy: { fixacaoFim: 'asc' },
    take: 25,
    include: {
      contrato: {
        select: { id: true, numero: true, cliente: { select: { nome: true } } },
      },
    },
  })

  const items = fixacoes.map((f) => {
    const fim = f.fixacaoFim ? new Date(f.fixacaoFim) : null
    const janelaHoras = fim
      ? Math.round((fim.getTime() - Date.now()) / 3_600_000)
      : null
    let janela = 'sem prazo'
    if (janelaHoras != null) {
      if (janelaHoras < 0) janela = 'janela fechada'
      else if (janelaHoras <= 12) janela = 'fecha hoje'
      else if (janelaHoras <= 48) janela = `${Math.ceil(janelaHoras / 24)}d`
      else janela = `${Math.ceil(janelaHoras / 24)} dias`
    }
    return {
      id: f.id,
      contratoId: f.contratoId,
      cliente: f.contrato?.cliente?.nome ?? 'Cliente',
      resumo: `${f.qtdRemanescenteSc.toLocaleString('pt-BR')} sc a fixar${f.gatilhoCultura ? ` · ${f.gatilhoCultura}` : ''}`,
      status: f.statusFixacao,
      qtdRemanescente: f.qtdRemanescenteSc,
      janela,
      janelaHoras,
      precoRef: f.gatilhoPrecoSc ?? null,
      cultura: f.gatilhoCultura ?? null,
      href: `/contratos/${f.contratoId}`,
    }
  })

  items.sort((a, b) => {
    if (a.janelaHoras == null) return 1
    if (b.janelaHoras == null) return -1
    return a.janelaHoras - b.janelaHoras
  })

  return NextResponse.json({ ok: true, items })
}
