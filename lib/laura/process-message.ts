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
import {
  classifyIntent,
  extractOrcamento,
  type LLMTelemetry,
} from './intent'
import { isFeatureEnabled } from '@/lib/features'

/**
 * Mescla múltiplas telemetrias de chamadas LLM em um único registro pra gravar
 * em LauraMessage. Soma tokens/custo/latência; preserva provider+model da
 * última chamada bem-sucedida; concatena erros distintos.
 */
function mergeTelemetry(parts: LLMTelemetry[]): LLMTelemetry | null {
  const real = parts.filter((p) => p.provider !== 'none' || p.errorMsg)
  if (real.length === 0) return null
  const successful = real.filter((p) => !p.errorMsg && p.provider !== 'none')
  const ref = successful[successful.length - 1] ?? real[real.length - 1]
  const errs = real.map((p) => p.errorMsg).filter(Boolean) as string[]
  return {
    provider: ref.provider,
    model: ref.model,
    tokensIn: real.reduce((s, p) => s + p.tokensIn, 0),
    tokensOut: real.reduce((s, p) => s + p.tokensOut, 0),
    costUsdMicros: real.reduce((s, p) => s + p.costUsdMicros, 0),
    latencyMs: real.reduce((s, p) => s + p.latencyMs, 0),
    errorMsg: errs.length ? errs.join(' | ').slice(0, 1000) : null,
  }
}

function telemetryToData(t: LLMTelemetry | null) {
  if (!t) return {}
  return {
    llmProvider: t.provider === 'none' ? null : t.provider,
    llmModel: t.model === 'none' ? null : t.model,
    tokensIn: t.tokensIn || null,
    tokensOut: t.tokensOut || null,
    custoUsdMicros: t.costUsdMicros || null,
    latencyMs: t.latencyMs || null,
    errorMsg: t.errorMsg,
  }
}

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
  const telemetryParts: LLMTelemetry[] = []
  const intentRes = await classifyIntent(textoParaAnalise)
  telemetryParts.push(intentRes.telemetry)
  const intentResp = intentRes.data

  await db.lauraConversation.update({
    where: { id: conv.id },
    data: { intentDetectado: intentResp.intent },
  })

  // Se classificação falhou de vez (sem provider real) e fallback heurístico
  // não detectou orçamento, persistimos telemetry e saímos sem chamar extrator.
  if (
    intentRes.telemetry.provider === 'none' &&
    intentResp.intent !== 'orcamento'
  ) {
    const merged = mergeTelemetry(telemetryParts)
    if (merged) {
      await db.lauraMessage.update({
        where: { id: msg.id },
        data: telemetryToData(merged),
      })
    }
    return {
      conversationId: conv.id,
      messageId: msg.id,
      proximaAcao: 'classificação IA falhou — revisar manualmente',
    }
  }

  // Se é orçamento + cliente identificado + alta confiança → cria proposta pendente
  if (
    intentResp.intent === 'orcamento' &&
    conv.clienteId &&
    intentResp.confianca >= 0.6
  ) {
    try {
      const extracaoRes = await extractOrcamento(textoParaAnalise)
      telemetryParts.push(extracaoRes.telemetry)
      const extracao = extracaoRes.data
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
        const merged = mergeTelemetry(telemetryParts)
        await db.lauraMessage.update({
          where: { id: msg.id },
          data: {
            propostaId: proposta.id,
            extracao: extracao as any,
            ...telemetryToData(merged),
          },
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
      const merged = mergeTelemetry(telemetryParts)
      if (merged) {
        await db.lauraMessage.update({
          where: { id: msg.id },
          data: telemetryToData(merged),
        })
      }
      return {
        conversationId: conv.id,
        messageId: msg.id,
        intent: intentResp.intent,
        proximaAcao: 'orçamento detectado mas dados insuficientes — humano responder',
      }
    } catch (err) {
      console.error('[laura] extractOrcamento failed:', err)
      const errMsg = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500)
      const merged = mergeTelemetry([
        ...telemetryParts,
        {
          provider: 'none',
          model: 'none',
          tokensIn: 0,
          tokensOut: 0,
          costUsdMicros: 0,
          latencyMs: 0,
          errorMsg: errMsg,
        },
      ])
      if (merged) {
        await db.lauraMessage.update({
          where: { id: msg.id },
          data: telemetryToData(merged),
        })
      }
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

  const merged = mergeTelemetry(telemetryParts)
  if (merged) {
    await db.lauraMessage.update({
      where: { id: msg.id },
      data: telemetryToData(merged),
    })
  }

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
