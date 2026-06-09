/**
 * GET /api/comissao/colaborador/relatorio?inicio=ISO&fim=ISO
 *
 * Relatório de comissão por colaborador no período. Para cada membro
 * comissionado: soma o que ele vendeu (contratos assinados via vendedorId) e
 * aplica a regra de comissão dele. Feature-gated por 'comissionamento'.
 *
 * Retorno: { ok, periodo, linhas: [{ memberId, nome, valorVendido,
 *            qtdContratos, tipoRegra, valorComissao, detalhe }], totais }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { isFeatureEnabled } from '@/lib/features'
import {
  calcularComissaoColaborador,
  type RegraComissao,
  type FaixaComissao,
} from '@/lib/comissao/colaborador'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function mesAtual(): { inicio: Date; fim: Date } {
  const now = new Date()
  return {
    inicio: new Date(now.getFullYear(), now.getMonth(), 1),
    fim: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await isFeatureEnabled(scope.workspaceId, 'comissionamento'))) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 403 })
  }

  const defaults = mesAtual()
  const inicio = searchParams.get('inicio') ? new Date(searchParams.get('inicio')!) : defaults.inicio
  const fim = searchParams.get('fim') ? new Date(searchParams.get('fim')!) : defaults.fim

  // 1. Membros comissionados + regra.
  const membros = await db.workspaceMember.findMany({
    where: scope.whereOwn({ comissionado: true }),
    select: {
      id: true, email: true, cargo: true,
      user: { select: { nome: true } },
      regraComissao: true,
    },
  })

  // 2. Vendas por vendedor (contratos assinados no período).
  const contratos = await db.contrato.findMany({
    where: scope.whereOwn({
      statusAssinatura: 'assinado',
      vendedorId: { not: null },
      OR: [
        { assinadoEm: { gte: inicio, lt: fim } },
        { assinadoEm: null, criadoEm: { gte: inicio, lt: fim } },
      ],
    }),
    select: { vendedorId: true, proposta: { select: { valorTotal: true } } },
  })

  const vendaPorMembro = new Map<string, { valor: number; qtd: number }>()
  for (const c of contratos) {
    if (!c.vendedorId) continue
    const cur = vendaPorMembro.get(c.vendedorId) ?? { valor: 0, qtd: 0 }
    cur.valor += Number(c.proposta?.valorTotal ?? 0)
    cur.qtd += 1
    vendaPorMembro.set(c.vendedorId, cur)
  }

  // 3. Aplica a regra de cada membro.
  const linhas = membros.map((m) => {
    const venda = vendaPorMembro.get(m.id) ?? { valor: 0, qtd: 0 }
    const r = m.regraComissao
    let valorComissao = 0
    let detalhe = 'sem regra configurada'
    let tipoRegra = '—'
    if (r && r.ativo) {
      const regra: RegraComissao = {
        tipo: r.tipo as RegraComissao['tipo'],
        pct: r.pct,
        valorFixo: r.valorFixo != null ? Number(r.valorFixo) : null,
        baseFixo: (r.baseFixo as 'periodo' | 'negocio') ?? 'periodo',
        faixas: (r.faixas as FaixaComissao[] | null) ?? null,
        ativo: r.ativo,
      }
      const res = calcularComissaoColaborador(regra, venda.valor, venda.qtd)
      valorComissao = res.valorComissao
      detalhe = res.detalhe
      tipoRegra = r.tipo
    }
    return {
      memberId: m.id,
      nome: m.user?.nome || m.cargo || m.email,
      valorVendido: venda.valor,
      qtdContratos: venda.qtd,
      tipoRegra,
      valorComissao,
      detalhe,
    }
  })

  linhas.sort((a, b) => b.valorComissao - a.valorComissao)

  return NextResponse.json({
    ok: true,
    periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
    linhas,
    totais: {
      vendido: linhas.reduce((s, l) => s + l.valorVendido, 0),
      comissao: linhas.reduce((s, l) => s + l.valorComissao, 0),
      colaboradores: linhas.length,
    },
  })
}
