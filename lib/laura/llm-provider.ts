/**
 * LLMProvider — abstração para Laura.IA escolher entre vendors.
 *
 * Implementações:
 *  - openrouter: usa OpenRouter (Llama-70B, Qwen, Mistral) — escolhido como
 *    default por estar dentro do budget zero/baixo
 *  - openai: usa OpenAI direto (escotilha pro futuro)
 *  - mock: retorna resposta determinística (testes / desenvolvimento)
 *
 * Selecionado por env LAURA_LLM_PROVIDER (default 'openrouter').
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionRequest {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  jsonMode?: boolean
}

export interface ChatCompletionResponse {
  content: string
  tokensIn: number
  tokensOut: number
  /** Custo estimado em USD (best-effort). */
  costUsd: number
  provider: string
  model: string
}

export interface LLMProvider {
  name: string
  chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse>
}

// ============================================================================
// OpenRouter — modelos free + pagos
// ============================================================================
class OpenRouterProvider implements LLMProvider {
  name = 'openrouter'

  private readonly apiKey: string
  private readonly defaultModel: string

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY ?? ''
    // Default: free tier do Llama 3.1 70B (gratuito até quota)
    this.defaultModel = process.env.LAURA_LLM_MODEL ?? 'meta-llama/llama-3.1-70b-instruct:free'
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY não configurada')
    }
    const model = req.model ?? this.defaultModel

    const body: Record<string, unknown> = {
      model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
    }
    if (req.jsonMode) {
      body.response_format = { type: 'json_object' }
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer':
          process.env.NEXT_PUBLIC_APP_URL ?? 'https://profitsync.ia.br',
        'X-Title': 'BH Grain / Laura.IA',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`OpenRouter ${res.status}: ${errBody.slice(0, 200)}`)
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content ?? ''
    const usage = json.usage ?? {}

    return {
      content,
      tokensIn: usage.prompt_tokens ?? 0,
      tokensOut: usage.completion_tokens ?? 0,
      costUsd: 0, // free tier — em modelos pagos OpenRouter retorna usage.cost
      provider: 'openrouter',
      model,
    }
  }
}

// ============================================================================
// OpenAI — escotilha pro futuro
// ============================================================================
class OpenAIProvider implements LLMProvider {
  name = 'openai'

  private readonly apiKey: string
  private readonly defaultModel: string

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY ?? ''
    this.defaultModel = process.env.LAURA_LLM_MODEL ?? 'gpt-4o-mini'
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY não configurada')
    }
    const model = req.model ?? this.defaultModel

    const body: Record<string, unknown> = {
      model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
    }
    if (req.jsonMode) {
      body.response_format = { type: 'json_object' }
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content ?? ''
    const usage = json.usage ?? {}

    // Preço aproximado gpt-4o-mini: $0.150 / 1M in, $0.600 / 1M out
    const costUsd =
      ((usage.prompt_tokens ?? 0) * 0.15 + (usage.completion_tokens ?? 0) * 0.6) /
      1_000_000

    return {
      content,
      tokensIn: usage.prompt_tokens ?? 0,
      tokensOut: usage.completion_tokens ?? 0,
      costUsd,
      provider: 'openai',
      model,
    }
  }
}

// ============================================================================
// Mock — pra testes / quando sem credenciais
// ============================================================================
class MockProvider implements LLMProvider {
  name = 'mock'

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const lastUser = [...req.messages]
      .reverse()
      .find((m) => m.role === 'user')?.content ?? ''
    return {
      content: req.jsonMode
        ? JSON.stringify({ intent: 'desconhecido', motivo: 'mock' })
        : `[mock] recebi: ${lastUser.slice(0, 80)}…`,
      tokensIn: lastUser.length,
      tokensOut: 20,
      costUsd: 0,
      provider: 'mock',
      model: 'mock-1',
    }
  }
}

let cached: LLMProvider | null = null

export function getLLMProvider(): LLMProvider {
  if (cached) return cached
  const which = (process.env.LAURA_LLM_PROVIDER ?? 'openrouter').toLowerCase()
  switch (which) {
    case 'openai':
      cached = new OpenAIProvider()
      break
    case 'mock':
      cached = new MockProvider()
      break
    case 'openrouter':
    default:
      // Se sem chave, cai pra mock
      if (!process.env.OPENROUTER_API_KEY) {
        cached = new MockProvider()
      } else {
        cached = new OpenRouterProvider()
      }
  }
  return cached
}
