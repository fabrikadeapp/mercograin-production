/**
 * Corretagem (comissão da Merco Grain) — relatório + aging + transição de status.
 *
 * GET   /api/comissao/corretagem            → lista com prevista/faturada/recebida,
 *                                             totais por status e alertas de atraso.
 * PATCH /api/comissao/corretagem            → muda status de uma apuração
 *                                             { id, acao: 'faturar'|'receber'|'cancelar' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const apuradas = await db.comissaoApurada.findMany({
    where: scope.whereOwn(),
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: {
      id: true, contratoId: true, status: true, baseCalculo: true,
      valorContrato: true, valorTotalComissao: true, toneladas: true,
      valorPorTonelada: true, quemPaga: true, valorComprador: true,
      valorVendedorPaga: true, valorCorretor: true, valorHouse: true,
      faturadaEm: true, vencimentoEm: true, recebidaEm: true, createdAt: true,
      regra: { select: { nome: true } },
    },
  })

  const now = Date.now()
  const norm = (s: string) =>
    s === 'apurada' ? 'prevista' : s === 'paga' ? 'recebida' : s // compat legado

  const itens = apuradas.map((a) => {
    const status = norm(a.status)
    const venc = a.vencimentoEm ? new Date(a.vencimentoEm).getTime() : null
    const atrasada = status === 'faturada' && venc != null && venc < now
    const diasAtraso = atrasada && venc ? Math.floor((now - venc) / 86_400_000) : 0
    return {
      id: a.id,
      contratoId: a.contratoId,
      regra: a.regra?.nome ?? '—',
      status,
      base: a.baseCalculo,
      valorContrato: Number(a.valorContrato),
      valorComissao: Number(a.valorTotalComissao),
      toneladas: Number(a.toneladas),
      valorPorTonelada: Number(a.valorPorTonelada),
      quemPaga: a.quemPaga,
      valorComprador: Number(a.valorComprador),
      valorVendedorPaga: Number(a.valorVendedorPaga),
      vencimentoEm: a.vencimentoEm?.toISOString() ?? null,
      atrasada,
      diasAtraso,
    }
  })

  const somaPor = (st: string) =>
    itens.filter((i) => i.status === st).reduce((s, i) => s + i.valorComissao, 0)

  return NextResponse.json({
    ok: true,
    itens,
    totais: {
      prevista: somaPor('prevista'),
      faturada: somaPor('faturada'),
      recebida: somaPor('recebida'),
      atrasadas: itens.filter((i) => i.atrasada).reduce((s, i) => s + i.valorComissao, 0),
      qtdAtrasadas: itens.filter((i) => i.atrasada).length,
    },
  })
}

const patchSchema = z.object({
  id: z.string().min(1),
  acao: z.enum(['faturar', 'receber', 'cancelar']),
})

export async function PATCH(req: NextRequest) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (scope.workspaceRole !== 'owner' && scope.workspaceRole !== 'admin' && !scope.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const { id, acao } = parsed.data

  const apurada = await db.comissaoApurada.findFirst({
    where: { id, ...scope.whereOwn() },
    select: { id: true, status: true },
  })
  if (!apurada) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (acao === 'faturar') {
    data.status = 'faturada'
    data.faturadaEm = new Date()
  } else if (acao === 'receber') {
    data.status = 'recebida'
    data.recebidaEm = new Date()
    data.pagaEm = new Date()
  } else {
    data.status = 'cancelada'
  }

  await db.comissaoApurada.update({ where: { id }, data })

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'corretagem_status',
    entidade: 'comissao_apurada',
    entidadeId: id,
    mudancas: { de: apurada.status, para: data.status },
  }).catch(() => undefined)

  return NextResponse.json({ ok: true, status: data.status })
}
