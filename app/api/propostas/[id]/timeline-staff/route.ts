/**
 * GET /api/propostas/[id]/timeline-staff
 *
 * Timeline completa para o painel interno (staff). Mais rica que a do portal.
 * Combina:
 *   - Marcos da proposta (criada, enviada, vista pelo cliente, fechada)
 *   - PropostaNota (notas livres do operador)
 *   - PropostaAgenda (agendamentos)
 *   - AuditLog filtrado para eventos relevantes
 *   - WebhookLog (acessos públicos, WhatsApp enviado)
 *
 * Ordenado cronologicamente, agendamentos futuros separados em "proximas".
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'

interface TimelineEvent {
  id: string
  tipo:
    | 'criacao'
    | 'envio'
    | 'visualizacao'
    | 'status'
    | 'nota'
    | 'agenda'
    | 'whatsapp'
    | 'email'
    | 'aceite'
    | 'recusa'
    | 'contrato'
    | 'outro'
  label: string
  detalhe?: string
  em: string
  autor?: string
  meta?: Record<string, unknown>
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const proposta = await db.proposta.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
      select: {
        id: true,
        numero: true,
        status: true,
        criadaEm: true,
        enviadaEm: true,
        vistaEm: true,
        vistasCount: true,
      },
    })
    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    const events: TimelineEvent[] = []
    const proximas: TimelineEvent[] = []
    const now = new Date()

    // Marcos derivados
    events.push({
      id: `m-criacao-${proposta.id}`,
      tipo: 'criacao',
      label: 'Proposta criada',
      em: proposta.criadaEm.toISOString(),
    })
    if (proposta.enviadaEm) {
      events.push({
        id: `m-envio-${proposta.id}`,
        tipo: 'envio',
        label: 'Enviada ao cliente',
        em: proposta.enviadaEm.toISOString(),
      })
    }
    if (proposta.vistaEm) {
      events.push({
        id: `m-vista-${proposta.id}`,
        tipo: 'visualizacao',
        label: 'Cliente visualizou',
        detalhe:
          proposta.vistasCount > 1 ? `${proposta.vistasCount} acessos no total` : undefined,
        em: proposta.vistaEm.toISOString(),
      })
    }

    // Notas
    const notas = await db.propostaNota.findMany({
      where: { propostaId: proposta.id, workspaceId: scope.workspaceId },
      orderBy: { criadaEm: 'desc' },
      take: 200,
    })
    for (const n of notas) {
      events.push({
        id: `n-${n.id}`,
        tipo: 'nota',
        label: n.categoria ? `Nota · ${n.categoria}` : 'Nota',
        detalhe: n.texto,
        autor: n.autorNome ?? undefined,
        em: n.criadaEm.toISOString(),
        meta: { notaId: n.id, categoria: n.categoria },
      })
    }

    // Agendamentos: concluídos/cancelados na timeline, pendentes em "proximas"
    const agendamentos = await db.propostaAgenda.findMany({
      where: { propostaId: proposta.id, workspaceId: scope.workspaceId },
      orderBy: { agendadoPara: 'desc' },
      take: 200,
    })
    for (const a of agendamentos) {
      const ev: TimelineEvent = {
        id: `a-${a.id}`,
        tipo: 'agenda',
        label:
          a.status === 'pendente'
            ? `Agendado: ${a.titulo}`
            : a.status === 'concluido'
              ? `Concluído: ${a.titulo}`
              : `Cancelado: ${a.titulo}`,
        detalhe: a.descricao ?? a.concluidoComentario ?? undefined,
        autor: a.responsavelNome ?? undefined,
        em: a.agendadoPara.toISOString(),
        meta: { agendaId: a.id, status: a.status },
      }
      if (a.status === 'pendente' && a.agendadoPara.getTime() > now.getTime()) {
        proximas.push(ev)
      } else {
        events.push(ev)
      }
    }

    // AuditLog filtrado (eventos relevantes pro operador)
    const audits = await db.auditLog.findMany({
      where: {
        workspaceId: scope.workspaceId,
        entidade: 'proposta',
        entidadeId: proposta.id,
        acao: {
          in: [
            'proposta_status_alterado',
            'proposta_editada',
            'proposta_autorizada',
            'proposta_rejeitada',
            'aceita_pelo_cliente_portal',
            'recusada_pelo_cliente_portal',
            'contra_oferta_cliente',
            'marcar_perdida',
            'proposta_followup_disparado',
            'share',
          ],
        },
      },
      orderBy: { criadoEm: 'asc' },
      take: 200,
      select: { id: true, acao: true, mudancas: true, criadoEm: true, userId: true },
    })
    for (const a of audits) {
      const acao = a.acao.toLowerCase()
      let tipo: TimelineEvent['tipo'] = 'outro'
      let label = a.acao
      let detalhe: string | undefined

      if (acao.includes('aceita_pelo_cliente_portal')) {
        tipo = 'aceite'
        label = 'Cliente aceitou'
        const m = (a.mudancas ?? {}) as Record<string, unknown>
        if (typeof m.aceitanteNome === 'string') detalhe = `por ${m.aceitanteNome}`
      } else if (acao.includes('recusada_pelo_cliente_portal')) {
        tipo = 'recusa'
        label = 'Cliente recusou no portal'
        const m = (a.mudancas ?? {}) as Record<string, unknown>
        if (typeof m.motivo === 'string') detalhe = m.motivo
      } else if (acao.includes('contra_oferta_cliente')) {
        tipo = 'outro'
        label = 'Cliente fez contra-oferta'
        const m = (a.mudancas ?? {}) as Record<string, unknown>
        if (typeof m.comentario === 'string') detalhe = m.comentario
      } else if (acao.includes('marcar_perdida')) {
        tipo = 'recusa'
        label = 'Marcada como perdida'
        const m = (a.mudancas ?? {}) as Record<string, unknown>
        if (typeof m.lossReason === 'string') detalhe = `motivo: ${m.lossReason}`
      } else if (acao.includes('proposta_followup_disparado')) {
        tipo = 'outro'
        label = 'Follow-up automático enviado'
      } else if (acao.includes('status_alterado')) {
        tipo = 'status'
        const m = (a.mudancas ?? {}) as Record<string, unknown>
        label = `Status: ${m.statusAnterior} → ${m.statusNovo}`
        if (typeof m.comentario === 'string') detalhe = m.comentario
      } else if (acao.includes('editada')) {
        tipo = 'outro'
        label = 'Proposta editada'
      } else if (acao.includes('autorizada')) {
        tipo = 'status'
        label = 'Autorizada para envio'
      } else if (acao.includes('share')) {
        tipo = 'outro'
        label = 'Link público gerado'
      }

      events.push({
        id: `audit-${a.id}`,
        tipo,
        label,
        detalhe,
        em: a.criadoEm.toISOString(),
      })
    }

    // WebhookLog para PDF acessado + WhatsApp enviado
    const webhooks = await db.webhookLog.findMany({
      where: {
        OR: [{ tipo: 'proposta_share_access' }, { tipo: 'whatsapp_send_auto' }],
      },
      orderBy: { criadoEm: 'asc' },
      take: 300,
      select: { id: true, tipo: true, payload: true, criadoEm: true },
    })
    for (const w of webhooks) {
      const payload = (w.payload ?? {}) as Record<string, unknown>
      if (String(payload.propostaId ?? '') !== proposta.id) continue
      if (w.tipo === 'proposta_share_access') {
        events.push({
          id: `wh-${w.id}`,
          tipo: 'visualizacao',
          label: 'PDF público acessado',
          em: w.criadoEm.toISOString(),
        })
      } else if (w.tipo === 'whatsapp_send_auto') {
        const categoria = String(payload.categoria ?? '')
        events.push({
          id: `wh-${w.id}`,
          tipo: 'whatsapp',
          label: 'WhatsApp enviado',
          detalhe: categoria,
          em: w.criadoEm.toISOString(),
        })
      }
    }

    // Ordena cronologicamente (eventos passados/presentes)
    events.sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime())
    // Agendamentos futuros: cronológicos crescentes
    proximas.sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime())

    return NextResponse.json({
      propostaNumero: proposta.numero,
      statusAtual: proposta.status,
      events,
      proximas,
    })
  } catch (err) {
    console.error('Timeline staff error:', err)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}
