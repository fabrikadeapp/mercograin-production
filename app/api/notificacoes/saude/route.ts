/**
 * GET /api/notificacoes/saude
 *
 * Dashboard de saúde das notificações. Agrega NotificacaoEntrega em:
 *   - KPIs por canal (whatsapp / email) em 3 janelas (24h / 7d / 30d)
 *     - total enviadas, total falhadas, taxa de sucesso
 *     - delivery rate (% que chegou em delivered/read, só para whatsapp)
 *   - Breakdown por categoria nas últimas 30d
 *   - Top 20 falhas recentes (com motivo, destinatário, categoria)
 *   - Status atual da WhatsAppInstance do workspace
 *
 * Filtros opcionais: ?canal=whatsapp&categoria=proposta_enviada_cliente
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

interface CanalKPI {
  total: number
  enviadas: number
  falhadas: number
  taxaSucesso: number
  delivered?: number
  read?: number
  deliveryRate?: number
}

interface JanelaKPI {
  whatsapp: CanalKPI
  email: CanalKPI
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = await getScope(searchParams)
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const now = new Date()
    const start24h = new Date(now.getTime() - 24 * 3600 * 1000)
    const start7d = new Date(now.getTime() - 7 * 86400 * 1000)
    const start30d = new Date(now.getTime() - 30 * 86400 * 1000)

    // Uma só query — todas as notificações dos últimos 30 dias.
    // Em produção com volume alto, considerar materialized view.
    const notificacoes = await db.notificacaoEntrega.findMany({
      where: {
        workspaceId: scope.workspaceId,
        criadoEm: { gte: start30d },
      },
      select: {
        canal: true,
        categoria: true,
        status: true,
        providerStatus: true,
        criadoEm: true,
        destinatario: true,
        destinatarioNome: true,
        errorMotivo: true,
        errorCodigo: true,
        retryCount: true,
        id: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        meta: true as any,
      },
      orderBy: { criadoEm: 'desc' },
    })

    const j24h = agregarJanela(notificacoes, start24h)
    const j7d = agregarJanela(notificacoes, start7d)
    const j30d = agregarJanela(notificacoes, start30d)

    // Breakdown por categoria
    const categoriaAgg = new Map<string, { total: number; falhadas: number }>()
    for (const n of notificacoes) {
      const slot = categoriaAgg.get(n.categoria) ?? { total: 0, falhadas: 0 }
      slot.total++
      if (n.status === 'falhou') slot.falhadas++
      categoriaAgg.set(n.categoria, slot)
    }
    const breakdownCategorias = Array.from(categoriaAgg.entries())
      .map(([categoria, a]) => ({
        categoria,
        total: a.total,
        falhadas: a.falhadas,
        taxaSucesso: a.total > 0 ? 1 - a.falhadas / a.total : 0,
      }))
      .sort((a, b) => b.total - a.total)

    // Top 20 falhas mais recentes
    const topFalhas = notificacoes
      .filter((n) => n.status === 'falhou')
      .slice(0, 20)
      .map((n) => ({
        id: n.id,
        canal: n.canal,
        categoria: n.categoria,
        destinatario: n.destinatario,
        destinatarioNome: n.destinatarioNome,
        errorMotivo: n.errorMotivo,
        errorCodigo: n.errorCodigo,
        retryCount: n.retryCount,
        criadoEm: n.criadoEm.toISOString(),
        meta: n.meta,
      }))

    // Status da instância WhatsApp
    const instancia = await db.whatsAppInstance.findUnique({
      where: { workspaceId: scope.workspaceId },
      select: {
        status: true,
        phoneNumber: true,
        connectedAt: true,
        disconnectedAt: true,
        lastQrAt: true,
      },
    })

    return NextResponse.json({
      janelas: { '24h': j24h, '7d': j7d, '30d': j30d },
      breakdownCategorias,
      topFalhas,
      whatsappInstance: instancia,
      geradoEm: now.toISOString(),
    })
  } catch (error) {
    console.error('Saude notificacoes error:', error)
    return NextResponse.json({ error: 'Erro ao agregar saúde' }, { status: 500 })
  }
}

interface NotifParcial {
  canal: string
  status: string
  providerStatus: string | null
  criadoEm: Date
}

function agregarJanela(notificacoes: NotifParcial[], desde: Date): JanelaKPI {
  const whats: CanalKPI = {
    total: 0,
    enviadas: 0,
    falhadas: 0,
    taxaSucesso: 0,
    delivered: 0,
    read: 0,
    deliveryRate: 0,
  }
  const email: CanalKPI = { total: 0, enviadas: 0, falhadas: 0, taxaSucesso: 0 }

  for (const n of notificacoes) {
    if (n.criadoEm < desde) continue
    const slot = n.canal === 'whatsapp' ? whats : email
    slot.total++
    if (n.status === 'falhou') {
      slot.falhadas++
    } else {
      slot.enviadas++
    }
    if (n.canal === 'whatsapp') {
      if (n.providerStatus === 'delivered') whats.delivered!++
      if (n.providerStatus === 'read') {
        whats.read!++
        whats.delivered!++ // read implica delivered
      }
    }
  }

  whats.taxaSucesso = whats.total > 0 ? whats.enviadas / whats.total : 0
  email.taxaSucesso = email.total > 0 ? email.enviadas / email.total : 0
  whats.deliveryRate =
    whats.enviadas > 0 ? whats.delivered! / whats.enviadas : 0

  return { whatsapp: whats, email }
}
