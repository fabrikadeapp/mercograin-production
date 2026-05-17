/**
 * Pipeline central da Laura.IA.
 *
 * Recebe uma mensagem entrante e:
 *  1. Encontra/cria LauraConversation (workspaceId + canal + handle)
 *  2. Grava LauraMessage(direcao='in')
 *  3. Identifica Cliente pelo telefone (Cliente.whatsapp)
 *  4. Classifica intent
 *  5. Se 'orcamento' + cliente identificado + confiança alta:
 *     - Extrai dados estruturados
 *     - Cria Proposta(aguardando_autorizacao) via Laura
 *     - Marca conversation status='aguardando_humano'
 *  6. Caso contrário, deixa pra humano responder
 *
 * Retorna info sobre ação tomada.
 */

import { db } from '@/lib/db'
import { classifyIntent, extractOrcamento } from './intent'
import { isFeatureEnabled } from '@/lib/features'

export interface ProcessMessageInput {
  workspaceId: string
  canal: 'whatsapp' | 'telefone' | 'webchat'
  handle: string // E.164 ou similar
  mensagem: string
  tipo?: 'text' | 'audio' | 'image' | 'document'
  /** Transcrição se audio */
  transcricao?: string
}

export interface ProcessMessageResult {
  conversationId: string
  messageId: string
  intent?: string
  propostaCriadaId?: string | null
  /** Próxima ação sugerida pra humano (ex: "responder com cotação atual de soja") */
  proximaAcao?: string
  /** Mensagem automática sugerida (não enviada por padrão) */
  respostaSugerida?: string
}

export async function processIncomingMessage(
  input: ProcessMessageInput,
): Promise<ProcessMessageResult> {
  // Verifica se feature laura_ai está habilitada pra workspace
  const enabled = await isFeatureEnabled(input.workspaceId, 'laura_ai')
  if (!enabled) {
    // Mesmo desligada, gravamos a mensagem pra histórico — só não processa intent
    const conv = await ensureConversation(input)
    const msg = await db.lauraMessage.create({
      data: {
        conversationId: conv.id,
        direcao: 'in',
        conteudo: input.mensagem,
        tipo: input.tipo ?? 'text',
        transcricao: input.transcricao ?? null,
      },
    })
    return {
      conversationId: conv.id,
      messageId: msg.id,
      proximaAcao: 'feature laura_ai desativada — responder manualmente',
    }
  }

  const conv = await ensureConversation(input)

  const msg = await db.lauraMessage.create({
    data: {
      conversationId: conv.id,
      direcao: 'in',
      conteudo: input.mensagem,
      tipo: input.tipo ?? 'text',
      transcricao: input.transcricao ?? null,
    },
  })

  await db.lauraConversation.update({
    where: { id: conv.id },
    data: { ultimaMensagemEm: new Date() },
  })

  // Identifica cliente se ainda não tem
  if (!conv.clienteId) {
    const cliente = await findClienteByHandle(input.workspaceId, input.handle)
    if (cliente) {
      await db.lauraConversation.update({
        where: { id: conv.id },
        data: { clienteId: cliente.id },
      })
      conv.clienteId = cliente.id
    }
  }

  // Classifica intent
  const textoParaAnalise = input.transcricao ?? input.mensagem
  let intentResp
  try {
    intentResp = await classifyIntent(textoParaAnalise)
  } catch (err) {
    console.error('[laura] classify failed:', err)
    return {
      conversationId: conv.id,
      messageId: msg.id,
      proximaAcao: 'classificação IA falhou — revisar manualmente',
    }
  }

  await db.lauraConversation.update({
    where: { id: conv.id },
    data: { intentDetectado: intentResp.intent },
  })

  // Se é orçamento + cliente identificado + alta confiança → cria proposta pendente
  if (
    intentResp.intent === 'orcamento' &&
    conv.clienteId &&
    intentResp.confianca >= 0.6
  ) {
    try {
      const extracao = await extractOrcamento(textoParaAnalise)
      if (
        extracao.confianca >= 0.5 &&
        extracao.quantidade &&
        extracao.precoSc &&
        extracao.grao !== 'outro'
      ) {
        const qtdSc = extracao.quantidade
        const subtotal = qtdSc * extracao.precoSc
        const proposta = await criarPropostaViaLaura({
          workspaceId: input.workspaceId,
          clienteId: conv.clienteId,
          canal: input.canal,
          tipo: extracao.tipo === 'venda' ? 'venda' : 'compra',
          grao: extracao.grao,
          qtdSc,
          precoSc: extracao.precoSc,
          subtotal,
          origem: `${input.canal}:${input.handle}`,
        })
        await db.lauraMessage.update({
          where: { id: msg.id },
          data: { propostaId: proposta.id, extracao: extracao as any },
        })
        await db.lauraConversation.update({
          where: { id: conv.id },
          data: { status: 'aguardando_humano' },
        })

        return {
          conversationId: conv.id,
          messageId: msg.id,
          intent: intentResp.intent,
          propostaCriadaId: proposta.id,
          proximaAcao: `proposta ${proposta.numero} criada — autorizar em /aprovacoes/propostas`,
        }
      }
      // Extração com baixa confiança — pede humano
      return {
        conversationId: conv.id,
        messageId: msg.id,
        intent: intentResp.intent,
        proximaAcao: 'orçamento detectado mas dados insuficientes — humano responder',
      }
    } catch (err) {
      console.error('[laura] extractOrcamento failed:', err)
      return {
        conversationId: conv.id,
        messageId: msg.id,
        intent: intentResp.intent,
        proximaAcao: 'falha na extração — humano responder',
      }
    }
  }

  // Outros intents → aguardando humano
  await db.lauraConversation.update({
    where: { id: conv.id },
    data: { status: 'aguardando_humano' },
  })

  return {
    conversationId: conv.id,
    messageId: msg.id,
    intent: intentResp.intent,
    proximaAcao: `intent=${intentResp.intent} — humano responder`,
  }
}

async function ensureConversation(input: ProcessMessageInput) {
  const existing = await db.lauraConversation.findUnique({
    where: {
      workspaceId_canal_handle: {
        workspaceId: input.workspaceId,
        canal: input.canal,
        handle: input.handle,
      },
    },
  })
  if (existing) return existing
  return db.lauraConversation.create({
    data: {
      workspaceId: input.workspaceId,
      canal: input.canal,
      handle: input.handle,
      status: 'aberta',
    },
  })
}

async function findClienteByHandle(workspaceId: string, handle: string) {
  // Normalização: remove tudo que não é dígito
  const digits = handle.replace(/\D/g, '')
  if (digits.length < 8) return null

  // Busca por whatsapp ou telefone que contenha os últimos 9 dígitos
  const last9 = digits.slice(-9)
  return db.cliente.findFirst({
    where: {
      workspaceId,
      OR: [
        { whatsapp: { contains: last9 } },
        { telefone: { contains: last9 } },
      ],
    },
    select: { id: true, nome: true },
  })
}

async function criarPropostaViaLaura(args: {
  workspaceId: string
  clienteId: string
  canal: string
  tipo: 'venda' | 'compra'
  grao: string
  qtdSc: number
  precoSc: number
  subtotal: number
  origem: string
}) {
  // Usa o gerador atômico existente
  const { nextNumber } = await import('@/lib/numbering/next-number')
  const numero = await nextNumber(args.workspaceId, 'proposta')

  const cliente = await db.cliente.findUnique({
    where: { id: args.clienteId },
    select: { responsavelId: true },
  })

  return db.proposta.create({
    data: {
      numero,
      clienteId: args.clienteId,
      workspaceId: args.workspaceId,
      tipo: args.tipo,
      graos: [
        {
          grao: args.grao,
          quantidade: args.qtdSc,
          preco: args.precoSc,
          subtotal: args.subtotal,
        },
      ],
      valorTotal: String(args.subtotal),
      status: 'aguardando_autorizacao',
      validadeEm: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      observacoes: `Origem: ${args.origem}`,
      gerenteContaId: cliente?.responsavelId ?? null,
      vendedorId: null,
      canalAutorizacao:
        args.canal === 'telefone'
          ? 'telefone'
          : args.canal === 'whatsapp'
            ? 'whatsapp'
            : 'ia_autonomo',
    },
  })
}
