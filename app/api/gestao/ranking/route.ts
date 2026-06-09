/**
 * GET /api/gestao/ranking?periodo=YYYY-MM — Ranking de vendedores (F4-03).
 *
 * Para cada vendedor (WorkspaceMember.isVendedor): volume vendido no período
 * (contratos assinados via vendedorId), comissão prevista (RegraComissao do
 * colaborador) e meta (MetaComercial). Ordena por valor vendido.
 *
 * PUT  /api/gestao/ranking — define meta de um vendedor { userId, periodo, valorMeta }.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { calcularComissaoColaborador, type RegraComissao, type FaixaComissao } from '@/lib/comissao/colaborador'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function periodoRange(periodo: string): { inicio: Date; fim: Date } {
  const [y, m] = periodo.split('-').map(Number)
  return { inicio: new Date(y, m - 1, 1), fim: new Date(y, m, 1) }
}
function periodoAtual(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const periodo = searchParams.get('periodo') || periodoAtual()
  const { inicio, fim } = periodoRange(periodo)

  const vendedores = await db.workspaceMember.findMany({
    where: scope.whereOwn({ isVendedor: true }),
    select: { id: true, userId: true, email: true, cargo: true, comissionado: true, user: { select: { nome: true } }, regraComissao: true },
  })

  const contratos = await db.contrato.findMany({
    where: scope.whereOwn({
      statusAssinatura: 'assinado',
      vendedorId: { not: null },
      OR: [{ assinadoEm: { gte: inicio, lt: fim } }, { assinadoEm: null, criadoEm: { gte: inicio, lt: fim } }],
    }),
    select: { vendedorId: true, proposta: { select: { valorTotal: true } } },
  })

  const venda = new Map<string, { valor: number; qtd: number }>()
  for (const c of contratos) {
    if (!c.vendedorId) continue
    const cur = venda.get(c.vendedorId) ?? { valor: 0, qtd: 0 }
    cur.valor += Number(c.proposta?.valorTotal ?? 0)
    cur.qtd += 1
    venda.set(c.vendedorId, cur)
  }

  // Metas do período (por userId).
  const metas = await db.metaComercial.findMany({
    where: scope.whereOwn({ periodo, commodity: null }),
    select: { userId: true, valorMeta: true },
  })
  const metaPorUser = new Map(metas.filter((m) => m.userId).map((m) => [m.userId!, Number(m.valorMeta)]))

  const linhas = vendedores.map((v) => {
    const vend = venda.get(v.id) ?? { valor: 0, qtd: 0 }
    let comissao = 0
    if (v.comissionado && v.regraComissao?.ativo) {
      const r = v.regraComissao
      const regra: RegraComissao = {
        tipo: r.tipo as RegraComissao['tipo'], pct: r.pct,
        valorFixo: r.valorFixo != null ? Number(r.valorFixo) : null,
        baseFixo: (r.baseFixo as 'periodo' | 'negocio') ?? 'periodo',
        faixas: (r.faixas as FaixaComissao[] | null) ?? null, ativo: r.ativo,
      }
      comissao = calcularComissaoColaborador(regra, vend.valor, vend.qtd).valorComissao
    }
    const meta = v.userId ? metaPorUser.get(v.userId) ?? 0 : 0
    return {
      memberId: v.id,
      userId: v.userId,
      nome: v.user?.nome || v.cargo || v.email,
      valorVendido: vend.valor,
      qtdContratos: vend.qtd,
      comissao,
      meta,
      atingimento: meta > 0 ? Math.round((vend.valor / meta) * 100) : null,
    }
  })

  linhas.sort((a, b) => b.valorVendido - a.valorVendido)
  linhas.forEach((l, i) => ((l as any).posicao = i + 1))

  return NextResponse.json({
    ok: true, periodo, linhas,
    totais: { vendido: linhas.reduce((s, l) => s + l.valorVendido, 0), comissao: linhas.reduce((s, l) => s + l.comissao, 0), vendedores: linhas.length },
  })
}

const putSchema = z.object({
  userId: z.string().min(1),
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  valorMeta: z.number().min(0),
})

export async function PUT(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (scope.workspaceRole !== 'owner' && scope.workspaceRole !== 'admin' && !scope.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const parsed = putSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const { userId, periodo, valorMeta } = parsed.data

  await db.metaComercial.upsert({
    where: { workspaceId_periodo_userId_commodity: { workspaceId: scope.workspaceId, periodo, userId, commodity: null as any } },
    create: { workspaceId: scope.workspaceId, periodo, userId, commodity: null, valorMeta },
    update: { valorMeta },
  }).catch(async () => {
    // Fallback se o unique com null não casar via composite: cria/atualiza manual.
    const existing = await db.metaComercial.findFirst({ where: { workspaceId: scope.workspaceId, periodo, userId, commodity: null } })
    if (existing) await db.metaComercial.update({ where: { id: existing.id }, data: { valorMeta } })
    else await db.metaComercial.create({ data: { workspaceId: scope.workspaceId, periodo, userId, commodity: null, valorMeta } })
  })

  return NextResponse.json({ ok: true })
}
