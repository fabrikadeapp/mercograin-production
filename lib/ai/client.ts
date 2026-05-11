/**
 * AI Client Resolver — escolhe entre chave gerenciada (PHB Grain) ou BYOK.
 *
 * Modo:
 *   - 'managed': usa OPENAI_API_KEY do servidor; sujeito a limite mensal do plano
 *   - 'byok':    decripta workspace.aiKeyEncrypted; sem limite (cliente paga)
 *
 * Verifica `Plan.aiAccess` antes de retornar o client:
 *   - 'none': lança AiNotAvailableError (plano não inclui AI)
 *   - 'managed' / 'byok_allowed': retorna client
 *
 * Subscription.plan é um SLUG (string), não FK — então fazemos lookup
 * separado em Plan por slug.
 */
import OpenAI from 'openai'
import { db } from '@/lib/db'
import { decryptApiKey } from './key-vault'

export class AiNotAvailableError extends Error {
  code = 'AI_NOT_AVAILABLE' as const
  constructor(public reason: 'plan' | 'no_key' | 'over_quota') {
    super(
      reason === 'plan'
        ? 'Seu plano não inclui o agente AI. Faça upgrade para Pro ou superior.'
        : reason === 'no_key'
          ? 'Workspace configurado como BYOK mas chave não foi cadastrada. Acesse Configurações → AI.'
          : 'Cota mensal de mensagens AI atingida. Faça upgrade ou aguarde renovação.',
    )
  }
}

export interface ResolvedAiClient {
  client: OpenAI
  model: string
  source: 'managed' | 'byok'
  /** Para uso em UI: indica se há cobrança extra de tokens */
  isMetered: boolean
}

/**
 * Resolve o client OpenAI a usar pelo workspace.
 * Carrega Workspace + Subscription; busca Plan por slug separadamente.
 */
export async function getAiClient(workspaceId: string): Promise<ResolvedAiClient> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      aiMode: true,
      aiKeyEncrypted: true,
      aiKeyIv: true,
      aiKeyTag: true,
      aiModel: true,
      subscription: { select: { plan: true } },
    },
  })

  if (!ws) {
    throw new AiNotAvailableError('plan')
  }

  const planSlug = ws.subscription?.plan
  let aiAccess = 'none'
  if (planSlug) {
    const plan = await db.plan.findUnique({
      where: { slug: planSlug },
      select: { aiAccess: true },
    })
    aiAccess = plan?.aiAccess ?? 'none'
  }

  if (aiAccess === 'none') {
    throw new AiNotAvailableError('plan')
  }

  // BYOK
  if (ws.aiMode === 'byok' && aiAccess === 'byok_allowed') {
    if (!ws.aiKeyEncrypted || !ws.aiKeyIv || !ws.aiKeyTag) {
      throw new AiNotAvailableError('no_key')
    }
    const apiKey = decryptApiKey({
      encrypted: ws.aiKeyEncrypted,
      iv: ws.aiKeyIv,
      tag: ws.aiKeyTag,
    })
    return {
      client: new OpenAI({ apiKey }),
      model: ws.aiModel || 'gpt-4o-mini',
      source: 'byok',
      isMetered: false,
    }
  }

  // Managed (default) — workspace.aiMode pode ser 'byok' mas plano não permite:
  // silenciosamente cai pra managed (super-admin que ajuste).
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada no servidor (modo managed).')
  }
  return {
    client: new OpenAI({ apiKey }),
    model: ws.aiModel || 'gpt-4o-mini',
    source: 'managed',
    isMetered: true,
  }
}
