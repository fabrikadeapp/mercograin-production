import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

/**
 * Cache 30s das fontes de notificação por workspace. Invalida quando
 * propostas/contratos/boletos sofrem mutation via revalidateTag.
 */
const getFontesCached = unstable_cache(
  async (workspaceId: string) => {
    const now = new Date()
    const in48h = new Date(now.getTime() + 48 * 3600 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 3600 * 1000)

    const [
      propostasVencendo,
      contratosNaoAssinados,
      boletosVencidos,
      propostasAguardando,
    ] = await Promise.all([
      db.proposta.findMany({
        where: {
          workspaceId,
          status: { in: ['enviada', 'em_negociacao', 'rascunho'] },
          validadeEm: { gte: now, lte: in48h },
        },
        select: {
          id: true,
          numero: true,
          validadeEm: true,
          cliente: { select: { nome: true } },
        },
        orderBy: { validadeEm: 'asc' },
        take: 10,
      }),
      db.contrato.findMany({
        where: {
          workspaceId,
          statusAssinatura: { in: ['pendente', null as any] },
          criadoEm: { lte: sevenDaysAgo },
        },
        select: {
          id: true,
          numero: true,
          criadoEm: true,
          cliente: { select: { nome: true } },
        },
        orderBy: { criadoEm: 'asc' },
        take: 5,
      }),
      db.boleto
        .findMany({
          where: {
            workspaceId,
            status: { in: ['vencido', 'pendente'] },
            vencimento: { gte: fourteenDaysAgo, lte: now },
          },
          select: {
            id: true,
            numero: true,
            vencimento: true,
            cliente: { select: { nome: true } },
          },
          orderBy: { vencimento: 'desc' },
          take: 5,
        })
        .catch(() => []),
      db.proposta.findMany({
        where: {
          workspaceId,
          status: 'aguardando_autorizacao',
        },
        select: {
          id: true,
          numero: true,
          criadaEm: true,
          canalAutorizacao: true,
          cliente: { select: { nome: true } },
        },
        orderBy: { criadaEm: 'desc' },
        take: 10,
      }),
    ])

    return {
      propostasVencendo,
      contratosNaoAssinados,
      boletosVencidos,
      propostasAguardando,
      now: now.toISOString(),
    }
  },
  ['notificacoes-fontes'],
  {
    revalidate: 30,
    tags: ['propostas', 'contratos', 'boletos'],
  },
)

/**
 * GET /api/bhgrain/notificacoes
 *
 * Agregador de notificações reais para o sino. Hoje cobre 3 fontes:
 *   1. Propostas vencendo nas próximas 48h
 *   2. Contratos sem assinatura há mais de 7 dias
 *   3. Boletos vencidos nos últimos 14 dias
 *
 * Quando houver model Notification dedicado, ele entra como fonte adicional
 * sem alterar o consumidor.
 */
export async function GET() {
  const scope = await getScope()
  if (!scope) {
    return NextResponse.json({ items: [] }, { status: 200 })
  }

  const items: Array<{
    id: string
    tipo: string
    title: string
    description?: string
    href?: string
    createdAt?: string
  }> = []

  const now = new Date()

  try {
    const fontes = await getFontesCached(scope.workspaceId)
    const propostasVencendo = fontes.propostasVencendo
    const contratosNaoAssinados = fontes.contratosNaoAssinados
    const boletosVencidos = fontes.boletosVencidos
    const propostasAguardando = fontes.propostasAguardando

    for (const p of propostasVencendo) {
      const horas = Math.max(
        1,
        Math.round((p.validadeEm.getTime() - now.getTime()) / 3600000),
      )
      items.push({
        id: `prop_${p.id}`,
        tipo: 'proposta_vencendo',
        title: `Proposta ${p.numero} vence em ${horas}h`,
        description: p.cliente?.nome,
        href: `/propostas/${p.id}`,
        createdAt: p.validadeEm.toISOString(),
      })
    }

    for (const c of contratosNaoAssinados) {
      const dias = Math.max(
        1,
        Math.round((now.getTime() - c.criadoEm.getTime()) / (24 * 3600000)),
      )
      items.push({
        id: `ctr_${c.id}`,
        tipo: 'silenciada',
        title: `Contrato ${c.numero} sem assinatura há ${dias} dias`,
        description: c.cliente?.nome,
        href: `/contratos/${c.id}`,
        createdAt: c.criadoEm.toISOString(),
      })
    }

    for (const p of propostasAguardando) {
      const canal = p.canalAutorizacao ?? 'IA'
      items.unshift({
        id: `aut_${p.id}`,
        tipo: 'alerta_preco',
        title: `Laura.IA aguardando autorização — ${p.numero}`,
        description: `${p.cliente?.nome ?? 'Cliente'} · canal ${canal}`,
        href: `/aprovacoes/propostas`,
        createdAt: p.criadaEm.toISOString(),
      })
    }

    for (const b of boletosVencidos) {
      items.push({
        id: `bol_${b.id}`,
        tipo: 'alerta_preco',
        title: `Boleto ${b.numero} vencido`,
        description: b.cliente?.nome ?? undefined,
        href: `/boletos`,
        createdAt: b.vencimento ? b.vencimento.toISOString() : undefined,
      })
    }
  } catch (e) {
    console.error('[bhgrain/notificacoes] erro:', e)
  }

  return NextResponse.json({ items })
}
