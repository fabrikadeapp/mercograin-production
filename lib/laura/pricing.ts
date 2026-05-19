/**
 * Tabela de preços de LLMs usados pela Laura.IA.
 *
 * Valores em USD por 1.000.000 (1M) de tokens. Sempre best-effort —
 * para modelos OpenRouter que devolvem `usage.total_cost` ou
 * `usage.cost` na resposta, prefira esse valor direto.
 *
 * Helpers retornam custo em **micro-USD** (1 USD = 1_000_000) para
 * persistir como `Int` no Postgres sem perda de precisão por float.
 */

export interface PricePerMillion {
  /** USD por 1M tokens de input. */
  in: number
  /** USD por 1M tokens de output. */
  out: number
}

/**
 * Tabela principal. Chaves são `provider` ou `provider:model`.
 * Lookup tenta `provider:model` primeiro, depois `provider`, depois default.
 */
const PRICING: Record<string, PricePerMillion> = {
  // Groq — free tier (não cobrado em runtime mesmo que tenha tokens)
  groq: { in: 0, out: 0 },

  // OpenRouter — default conservador (modelos free retornam 0;
  // pagos costumam mandar `usage.cost` direto, então essa tabela é fallback).
  openrouter: { in: 0.5, out: 1.5 },

  // OpenAI gpt-4o-mini (default em llm-provider.ts)
  'openai:gpt-4o-mini': { in: 0.15, out: 0.6 },
  // Fallback OpenAI (modelos não mapeados): assume 4o-mini-ish
  openai: { in: 0.15, out: 0.6 },

  // Mock — gratuito
  mock: { in: 0, out: 0 },
}

/**
 * Calcula custo em **micro-USD** dado provider/model e tokens consumidos.
 *
 * @param provider — nome canônico ('groq', 'openrouter', 'openai', 'mock')
 * @param model — modelo específico (ex: 'gpt-4o-mini')
 * @param tokensIn — input tokens
 * @param tokensOut — output tokens
 * @param overrideUsd — se o provider devolveu custo direto (USD), usa esse valor
 */
export function calcCostMicros(
  provider: string,
  model: string | null | undefined,
  tokensIn: number,
  tokensOut: number,
  overrideUsd?: number | null,
): number {
  if (typeof overrideUsd === 'number' && Number.isFinite(overrideUsd) && overrideUsd >= 0) {
    return Math.round(overrideUsd * 1_000_000)
  }
  const key = model ? `${provider}:${model}` : provider
  const price = PRICING[key] ?? PRICING[provider] ?? PRICING.openrouter
  const usd = (tokensIn * price.in + tokensOut * price.out) / 1_000_000
  return Math.round(usd * 1_000_000)
}

/** Converte micro-USD pra USD pra exibição. */
export function microsToUsd(micros: number | null | undefined): number {
  if (!micros) return 0
  return micros / 1_000_000
}

/** Formata micro-USD como string `$0.0001234`. */
export function formatMicrosUsd(micros: number | null | undefined): string {
  const usd = microsToUsd(micros)
  if (usd === 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(6)}`
  return `$${usd.toFixed(4)}`
}
