/**
 * BH Grain — Hook não-bloqueante para classificar mensagens WhatsApp
 * que chegam via webhook Evolution e gerar Conversation/ConversationMessage
 * unificados + (quando aplicável) Proposta em 'rascunho_ia'.
 *
 * Regras críticas:
 *  - NUNCA envia mensagens automaticamente.
 *  - NUNCA persiste preço sem fonte + timestamp.
 *  - Falha silenciosa: erros aqui NÃO podem derrubar o webhook.
 *  - Idempotência: usa externalRef = messageId; upsert na Conversation por
 *    (workspaceId, channel, externalRef=jid).
 *  - Só age quando bhgrain.v1 está ligado (feature flag).
 */

import { db } from '@/lib/db'
import { classificarMensagem, type ClassificationResult } from './ai-classifier'
import { calcularScore } from './scoring'
import { calcularMargem } from './margem'
import { isBhGrainV1Enabled } from './feature-flag'
import { captureError } from '@/lib/observability/capture'

interface WireInput {
  workspaceId: string
  contactId: string
  jid: string
  contactName: string | null
  contactPhone: string | null
  messageId: string
  text: string | null
  timestamp: Date
  fromMe: boolean
}

/**
 * Hook chamado pelo webhook após persistir WhatsAppMessage. Fire-and-forget.
 */
export async function wireBhGrainFromWhatsApp(input: WireInput): Promise<void> {
  try {
    // Não classifica mensagens enviadas por nós, sem texto, ou flag off
    if (input.fromMe || !input.text?.trim()) return
    const enabled = await isBhGrainV1Enabled()
    if (!enabled) return

    // 1. Upsert Conversation (uma por jid)
    const conv = await db.conversation.upsert({
      where: {
        workspaceId_channel_externalRef: {
          workspaceId: input.workspaceId,
          channel: 'whatsapp',
          externalRef: input.jid,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        channel: 'whatsapp',
        externalRef: input.jid,
        contactName: input.contactName,
        contactHandle: input.contactPhone,
        lastMessageAt: input.timestamp,
        unreadCount: 1,
        aiStatus: 'aguardando',
      },
      update: {
        contactName: input.contactName ?? undefined,
        lastMessageAt: input.timestamp,
        unreadCount: { increment: 1 },
      },
    })

    // 2. Classifica via IA (heurística + OpenAI opcional).
    // Resolve chave por workspace (BYOK) com fallback para env.
    const aiKey = await resolveAiKeyForWorkspace(input.workspaceId)
    const classification = await classificarMensagem(input.text, {
      openaiKey: aiKey,
      model: process.env.BHGRAIN_AI_MODEL ?? 'gpt-4o-mini',
    })

    // 3. Persiste ConversationMessage idempotente
    await db.conversationMessage
      .create({
        data: {
          workspaceId: input.workspaceId,
          conversationId: conv.id,
          externalRef: input.messageId,
          direction: 'in',
          text: input.text,
          aiExtraction: classification as unknown as object,
          aiScore: null,
          occurredAt: input.timestamp,
        },
      })
      .catch(() => {
        // re-entrega — ignora
      })

    // 4. Atualiza aiStatus da Conversation
    await db.conversation.update({
      where: { id: conv.id },
      data: { aiStatus: classification.status },
    })

    // 5. Se pronto-para-proposta → tenta criar Rascunho IA
    if (classification.status === 'pronta_para_proposta') {
      await criarRascunhoIA(input.workspaceId, input.contactId, classification).catch((e) =>
        captureError(e, { where: 'wire-whatsapp.criarRascunhoIA', workspaceId: input.workspaceId })
      )
    }
  } catch (e) {
    // Falha silenciosa — não pode quebrar webhook
    captureError(e, { where: 'wire-whatsapp.wireBhGrainFromWhatsApp', workspaceId: input.workspaceId })
  }
}

/**
 * Cria Proposta status='rascunho_ia' a partir da classificação.
 * Vincula cotação atual do banco como referência (fonte + timestamp obrigatórios).
 * Sempre `requiresHumanApproval = true` implícito (status rascunho_ia).
 */
async function criarRascunhoIA(
  workspaceId: string,
  contactId: string,
  c: ClassificationResult
): Promise<void> {
  if (!c.commodity || c.quantidade == null) return

  // Procura cliente vinculado ao contato WhatsApp; se não existir, não cria proposta
  const contact = await db.whatsAppContact.findUnique({
    where: { id: contactId },
    select: { clienteId: true },
  })
  if (!contact?.clienteId) return // mensagem de lead sem cliente — proposta exige cliente

  // Busca última cotação para a commodity
  const grao = c.commodity.toLowerCase().includes('soja')
    ? 'soja'
    : c.commodity.toLowerCase().includes('milho')
      ? 'milho'
      : c.commodity.toLowerCase().includes('trigo')
        ? 'trigo'
        : null
  if (!grao) return

  const cotacao = await db.cotacao.findFirst({
    where: { grao },
    orderBy: { data: 'desc' },
  })
  if (!cotacao) return // sem fonte = não cria proposta (regra do prompt)

  const preco = Number(cotacao.close ?? cotacao.preco)
  if (!Number.isFinite(preco) || preco <= 0) return

  const valorTotal = preco * c.quantidade

  // Validade default: 15 minutos (deveria vir de CommercialRule mas é fallback)
  const validadeCotacao = new Date(Date.now() + 15 * 60 * 1000)
  const validadeProposta = new Date(Date.now() + 24 * 3600 * 1000)

  // Margem placeholder: 0 (não temos custo). UI mostra '—'.
  const margem = calcularMargem({
    precoVenda: preco,
    custoUnitario: null,
    quantidade: c.quantidade,
  })

  // Score sem histórico — usa só sinais da mensagem + cotação fresca
  const score = calcularScore({
    clienteRecorrente: false,
    clienteTaxaSucessoHistorica: null,
    ticketMedioCliente: null,
    precoProposta: preco,
    precoMercadoAtual: preco,
    margemPercent: null,
    margemMinima: null,
    diasSemContato: null,
    statusProposta: 'rascunho_ia',
    validadeCotacaoRestanteMin: 15,
  })

  // Gera número curto idempotente para este contato + timestamp
  const numero = `IA-${Date.now().toString(36).toUpperCase()}-${contact.clienteId.slice(-4)}`

  const proposta = await db.proposta.create({
    data: {
      workspaceId,
      clienteId: contact.clienteId,
      numero,
      tipo: 'venda',
      graos: {
        commodity: c.commodity,
        quantidade: c.quantidade,
        unidade: c.unidade ?? 'sc',
        preco,
        localEntrega: c.localEntrega ?? null,
      },
      valorTotal: margem.valorTotal,
      status: 'rascunho_ia',
      validadeEm: validadeProposta,
      // BH Grain
      scoreInterno: score.score,
      scoreLabel: score.label,
      cotacaoRefId: cotacao.id,
      cotacaoFonte: cotacao.fonte,
      cotacaoCapturadaEm: cotacao.data,
      validadeCotacao,
      marketPriceAtCreation: preco,
    },
    select: { id: true, numero: true },
  })

  // Audit
  await db.auditLog
    .create({
      data: {
        userId: 'system:bhgrain-ai',
        acao: 'Rascunho IA criado',
        entidade: 'Proposta',
        entidadeId: proposta.id,
        workspaceId,
        mudancas: {
          numero: proposta.numero,
          fonte: 'whatsapp-webhook',
          classification: c as unknown as object,
        },
      },
    })
    .catch(() => {})

  // Abre Aprovação automaticamente — IA NUNCA envia sem revisão humana
  try {
    const { avaliarAprovacao, abrirAprovacao } = await import('./proposta-approval')
    const aval = await avaliarAprovacao(proposta.id, workspaceId)
    if (aval.precisa) {
      // Solicitante: owner do workspace (fallback) — sistema não tem User real
      const owner = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { ownerId: true },
      })
      if (owner?.ownerId) {
        await abrirAprovacao({
          propostaId: proposta.id,
          workspaceId,
          solicitanteId: owner.ownerId,
          motivos: ['Proposta gerada por IA', ...aval.motivos],
          regrasAplicadasIds: aval.regrasAplicadas.map((r) => r.id),
          workflow: aval.workflowSugerido ?? { etapas: [{ ordem: 1, role: 'gestor', nome: 'Aprovação' }], slaHoras: 48 },
        })
      }
    }
  } catch {
    /* falha silenciosa, audit já registrou criação */
  }
}

/**
 * Resolve chave OpenAI a usar para classificação BH Grain.
 * Prioridade:
 *   1. Workspace.aiKeyEncrypted (BYOK do cliente)
 *   2. process.env.OPENAI_API_KEY (managed central)
 *   3. null → cai na heurística pura
 */
async function resolveAiKeyForWorkspace(workspaceId: string): Promise<string | null> {
  try {
    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { aiMode: true, aiKeyEncrypted: true, aiKeyIv: true, aiKeyTag: true },
    })
    if (ws?.aiMode === 'byok' && ws.aiKeyEncrypted && ws.aiKeyIv && ws.aiKeyTag) {
      const { decryptApiKey } = await import('@/lib/ai/key-vault')
      return decryptApiKey({ encrypted: ws.aiKeyEncrypted, iv: ws.aiKeyIv, tag: ws.aiKeyTag })
    }
  } catch {
    /* fallback para env */
  }
  return process.env.OPENAI_API_KEY ?? null
}
