/**
 * Classificação de intent e extração estruturada de mensagens.
 *
 * Pipeline:
 *  1. classifyIntent(msg) → 'orcamento' | 'duvida' | 'agradecimento' | 'spam' | 'outro'
 *  2. Se 'orcamento': extractOrcamento(msg) → { grao, qtdSacas, precoSc, tipo }
 *  3. Caller decide: criar Proposta(aguardando_autorizacao) ou pedir clarif.
 */

import { z } from 'zod'
import { getLLMProvider, type ChatMessage } from './llm-provider'

// ----------------------------------------------------------------------------
// INTENT CLASSIFIER
// ----------------------------------------------------------------------------

export const INTENTS = [
  'orcamento',
  'duvida',
  'confirmacao',
  'agradecimento',
  'reclamacao',
  'spam',
  'outro',
] as const
export type Intent = (typeof INTENTS)[number]

const intentSchema = z.object({
  intent: z.enum(INTENTS),
  confianca: z.number().min(0).max(1),
  motivo: z.string().optional(),
})

const INTENT_SYSTEM_PROMPT = `Você é um classificador de intenção de mensagens recebidas em uma corretora de grãos via WhatsApp.

Classifique a mensagem em UMA das categorias:
- orcamento: cliente quer comprar/vender grãos (soja, milho, trigo). Menciona quantidade, preço ou cotação.
- duvida: cliente pergunta algo (status, prazo, condição, contrato).
- confirmacao: cliente confirma proposta enviada anteriormente.
- agradecimento: mensagem curta de cordialidade.
- reclamacao: insatisfação com serviço/produto.
- spam: mensagem fora de contexto, promocional, automática.
- outro: nenhuma das anteriores.

Retorne JSON estritamente neste formato:
{ "intent": "<categoria>", "confianca": 0.0-1.0, "motivo": "breve explicação" }`

export async function classifyIntent(
  mensagem: string,
): Promise<z.infer<typeof intentSchema>> {
  const llm = getLLMProvider()
  const messages: ChatMessage[] = [
    { role: 'system', content: INTENT_SYSTEM_PROMPT },
    { role: 'user', content: mensagem },
  ]
  const resp = await llm.chat({ messages, jsonMode: true, temperature: 0.1 })
  try {
    const parsed = intentSchema.parse(JSON.parse(resp.content))
    return parsed
  } catch (err) {
    // Fallback heurístico se LLM falhar
    return fallbackClassify(mensagem)
  }
}

function fallbackClassify(msg: string): z.infer<typeof intentSchema> {
  const lower = msg.toLowerCase()
  if (/quero|vender|comprar|saca|tonelada|soja|milho|trigo/.test(lower)) {
    return { intent: 'orcamento', confianca: 0.6, motivo: 'fallback heurístico' }
  }
  if (/obrigad|valeu|tmj/.test(lower)) {
    return { intent: 'agradecimento', confianca: 0.7 }
  }
  if (/\?$|\?/.test(msg)) {
    return { intent: 'duvida', confianca: 0.5 }
  }
  return { intent: 'outro', confianca: 0.3 }
}

// ----------------------------------------------------------------------------
// EXTRATOR DE ORÇAMENTO
// ----------------------------------------------------------------------------

export const orcamentoSchema = z.object({
  tipo: z.enum(['compra', 'venda', 'indefinido']),
  grao: z.enum(['soja', 'milho', 'trigo', 'outro']),
  quantidade: z.number().positive().nullable(),
  unidade: z.enum(['sc', 't', 'kg']).default('sc'),
  precoSc: z.number().positive().nullable(),
  observacao: z.string().optional(),
  /** Confiança geral da extração */
  confianca: z.number().min(0).max(1),
})

const EXTRATOR_SYSTEM_PROMPT = `Você é um extrator estruturado de pedidos de orçamento em uma corretora de grãos.

Extraia da mensagem do cliente:
- tipo: 'compra' (cliente quer comprar), 'venda' (cliente quer vender), ou 'indefinido'
- grao: 'soja', 'milho', 'trigo' ou 'outro'
- quantidade: número de sacas/toneladas (null se não mencionado)
- unidade: 'sc' (sacas 60kg), 't' (toneladas) ou 'kg'
- precoSc: preço por saca em R$ (null se não mencionado)
- observacao: detalhes adicionais relevantes (localização, prazo, etc)
- confianca: 0.0 a 1.0 indicando quão claro foi extrair

Retorne JSON ESTRITAMENTE neste formato. Use null para campos não mencionados:
{
  "tipo": "compra|venda|indefinido",
  "grao": "soja|milho|trigo|outro",
  "quantidade": número ou null,
  "unidade": "sc|t|kg",
  "precoSc": número ou null,
  "observacao": "string ou vazio",
  "confianca": 0.0-1.0
}`

export async function extractOrcamento(
  mensagem: string,
): Promise<z.infer<typeof orcamentoSchema>> {
  const llm = getLLMProvider()
  const messages: ChatMessage[] = [
    { role: 'system', content: EXTRATOR_SYSTEM_PROMPT },
    { role: 'user', content: mensagem },
  ]
  const resp = await llm.chat({ messages, jsonMode: true, temperature: 0.1 })
  try {
    return orcamentoSchema.parse(JSON.parse(resp.content))
  } catch {
    return {
      tipo: 'indefinido',
      grao: 'outro',
      quantidade: null,
      unidade: 'sc',
      precoSc: null,
      confianca: 0,
    }
  }
}
