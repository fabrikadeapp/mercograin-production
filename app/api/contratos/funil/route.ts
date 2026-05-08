/**
 * GET /api/contratos/funil
 * Pipeline agregado por estágio.
 *
 * Como o model Contrato atual não tem coluna `stage`, derivamos:
 * - prospeccao   ← propostas em rascunho (do usuário)
 * - cotacao      ← propostas enviadas
 * - negociacao   ← propostas aceitas mas sem contrato
 * - assinado     ← contratos com statusAssinatura='assinado'
 * - fechado      ← contratos com dataFim no passado e assinados
 */
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const userId = session.user.id

    const [propostas, contratos] = await Promise.all([
      db.proposta.findMany({
        where: { cliente: { usuarioId: userId } },
        select: { id: true, status: true, valorTotal: true, contratos: { select: { id: true } } },
      }),
      db.contrato.findMany({
        where: { cliente: { usuarioId: userId } },
        select: { id: true, statusAssinatura: true, dataFim: true, proposta: { select: { valorTotal: true } } },
      }),
    ])

    const now = new Date()
    const stages = {
      prospeccao: { count: 0, total: 0 },
      cotacao: { count: 0, total: 0 },
      negociacao: { count: 0, total: 0 },
      assinado: { count: 0, total: 0 },
      fechado: { count: 0, total: 0 },
    }

    for (const p of propostas) {
      const v = Number(p.valorTotal)
      if (p.status === 'rascunho') {
        stages.prospeccao.count++
        stages.prospeccao.total += v
      } else if (p.status === 'enviada') {
        stages.cotacao.count++
        stages.cotacao.total += v
      } else if (p.status === 'aceita' && p.contratos.length === 0) {
        stages.negociacao.count++
        stages.negociacao.total += v
      }
    }
    for (const c of contratos) {
      const v = Number(c.proposta?.valorTotal || 0)
      if (c.dataFim && c.dataFim < now) {
        stages.fechado.count++
        stages.fechado.total += v
      } else if (c.statusAssinatura === 'assinado') {
        stages.assinado.count++
        stages.assinado.total += v
      }
    }

    const totalCount =
      stages.prospeccao.count +
      stages.cotacao.count +
      stages.negociacao.count +
      stages.assinado.count +
      stages.fechado.count

    const fmtBRL = (n: number) =>
      n >= 1_000_000
        ? `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
        : n >= 1_000
          ? `R$ ${(n / 1_000).toFixed(0)}k`
          : `R$ ${n.toFixed(0)}`

    const items = [
      { key: 'prospeccao', stage: 'EM PROSPECÇÃO', color: 'var(--info)', ...stages.prospeccao },
      { key: 'cotacao', stage: 'COTAÇÃO ENVIADA', color: 'color-mix(in srgb, var(--info) 60%, var(--bg-3))', ...stages.cotacao },
      { key: 'negociacao', stage: 'EM NEGOCIAÇÃO', color: 'var(--warn)', ...stages.negociacao },
      { key: 'assinado', stage: 'ASSINADO', color: 'var(--accent)', ...stages.assinado },
      { key: 'fechado', stage: 'FECHADO', color: 'var(--grain-usd)', ...stages.fechado },
    ].map((it) => ({
      stage: it.stage,
      color: it.color,
      count: it.count,
      percent: totalCount > 0 ? Math.round((it.count / totalCount) * 100) : 0,
      total: fmtBRL(it.total),
    }))

    return NextResponse.json({ items, totalCount })
  } catch (e: any) {
    console.error('GET /contratos/funil error:', e)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}
