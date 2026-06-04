/**
 * GET /api/portal/propostas/[id]/timeline
 *
 * Histórico de eventos da proposta visíveis ao cliente.
 * Combina:
 *   - Marcos derivados da própria Proposta (criada, enviada, aceita…)
 *   - Eventos do AuditLog com entidade='proposta' e entidadeId=this
 *   - Eventos do WebhookLog (acesso ao link público, WhatsApp enviado)
 *
 * Filtrado por sessão portal: só vê os marcos do próprio cliente.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePortal } from '@/lib/portal-produtor/scope'

interface TimelineEvent {
  /** Identificador estável pra key React. */
  id: string
  /** Categoria visual: criacao, envio, abertura, aceite, recusa, contrato, assinatura, outro. */
  tipo:
    | 'criacao'
    | 'envio'
    | 'abertura'
    | 'aceite'
    | 'recusa'
    | 'contrato'
    | 'assinatura'
    | 'outro'
  /** Texto curto pro card. */
  label: string
  /** Detalhe opcional. */
  detalhe?: string
  /** ISO. */
  em: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sess = await requirePortal()
    if (!sess) {
      return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
    }

    const proposta = await db.proposta.findFirst({
      where: {
        id: params.id,
        clienteId: sess.clienteId,
        workspaceId: sess.workspaceId,
      },
      select: {
        id: true,
        numero: true,
        status: true,
        criadaEm: true,
        enviadaEm: true,
        atualizadaEm: true,
        autorizadoEm: true,
      },
    })

    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 })
    }

    const events: TimelineEvent[] = []

    // 1. Marcos da proposta
    events.push({
      id: `criacao-${proposta.id}`,
      tipo: 'criacao',
      label: 'Proposta criada',
      detalhe: `Proposta ${proposta.numero}`,
      em: proposta.criadaEm.toISOString(),
    })
    if (proposta.enviadaEm) {
      events.push({
        id: `envio-${proposta.id}`,
        tipo: 'envio',
        label: 'Enviada para você',
        em: proposta.enviadaEm.toISOString(),
      })
    }

    // 2. AuditLog desta proposta
    const audits = await db.auditLog.findMany({
      where: {
        workspaceId: sess.workspaceId,
        entidade: 'proposta',
        entidadeId: proposta.id,
      },
      orderBy: { criadoEm: 'asc' },
      take: 50,
      select: { id: true, acao: true, mudancas: true, criadoEm: true },
    })

    for (const a of audits) {
      const acao = a.acao.toLowerCase()
      let tipo: TimelineEvent['tipo'] = 'outro'
      let label = a.acao
      let detalhe: string | undefined

      if (acao.includes('aceita_pelo_cliente_portal') || acao.includes('aceita')) {
        tipo = 'aceite'
        label = 'Você aceitou a proposta'
        const m = (a.mudancas ?? {}) as Record<string, unknown>
        if (typeof m.aceitanteNome === 'string') detalhe = `por ${m.aceitanteNome}`
      } else if (acao.includes('recusada') || acao.includes('rejeitada')) {
        tipo = 'recusa'
        label = 'Proposta recusada'
        const m = (a.mudancas ?? {}) as Record<string, unknown>
        if (typeof m.motivo === 'string') detalhe = m.motivo
      } else if (acao.includes('autorizada') || acao === 'proposta_autorizada') {
        tipo = 'envio'
        label = 'Aprovação interna concluída'
      } else if (acao.includes('share')) {
        tipo = 'outro'
        label = 'Link compartilhável gerado'
      } else if (acao.includes('create') || acao.includes('criar')) {
        // já cobrimos via marco da proposta
        continue
      } else {
        // ignora eventos internos não visíveis ao cliente
        continue
      }

      events.push({
        id: `audit-${a.id}`,
        tipo,
        label,
        detalhe,
        em: a.criadoEm.toISOString(),
      })
    }

    // 3. WebhookLog — acessos públicos ao PDF e envios de WhatsApp
    const webhooks = await db.webhookLog.findMany({
      where: {
        OR: [
          { tipo: 'proposta_share_access' },
          { tipo: 'whatsapp_send' },
        ],
      },
      orderBy: { criadoEm: 'asc' },
      take: 100,
      select: { id: true, tipo: true, payload: true, criadoEm: true },
    })

    for (const w of webhooks) {
      const payload = (w.payload ?? {}) as Record<string, unknown>
      const pid = String(payload.propostaId ?? '')
      if (pid !== proposta.id) continue
      if (w.tipo === 'proposta_share_access') {
        events.push({
          id: `wh-${w.id}`,
          tipo: 'abertura',
          label: 'PDF acessado',
          em: w.criadoEm.toISOString(),
        })
      } else if (w.tipo === 'whatsapp_send') {
        events.push({
          id: `wh-${w.id}`,
          tipo: 'envio',
          label: 'Notificação enviada por WhatsApp',
          em: w.criadoEm.toISOString(),
        })
      }
    }

    // 4. Contrato vinculado (se houver)
    const contrato = await db.contrato.findFirst({
      where: { proposIdFk: proposta.id, workspaceId: sess.workspaceId },
      select: {
        id: true,
        numero: true,
        criadoEm: true,
        statusAssinatura: true,
        assinaturaDigital: {
          select: { enviadoEm: true, finalizadoEm: true, status: true },
        },
      },
    })
    if (contrato) {
      events.push({
        id: `contrato-${contrato.id}`,
        tipo: 'contrato',
        label: `Contrato ${contrato.numero} gerado`,
        em: contrato.criadoEm.toISOString(),
      })
      if (contrato.assinaturaDigital?.enviadoEm) {
        events.push({
          id: `assin-${contrato.id}-enviado`,
          tipo: 'assinatura',
          label: 'Contrato enviado para assinatura',
          em: contrato.assinaturaDigital.enviadoEm.toISOString(),
        })
      }
      if (
        contrato.assinaturaDigital?.finalizadoEm &&
        contrato.assinaturaDigital.status === 'assinado'
      ) {
        events.push({
          id: `assin-${contrato.id}-assinado`,
          tipo: 'assinatura',
          label: 'Contrato assinado',
          em: contrato.assinaturaDigital.finalizadoEm.toISOString(),
        })
      }
    }

    // Ordena cronologicamente
    events.sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime())

    return NextResponse.json({ propostaNumero: proposta.numero, events })
  } catch (error) {
    console.error('Portal timeline error:', error)
    return NextResponse.json({ error: 'Erro ao carregar histórico' }, { status: 500 })
  }
}
