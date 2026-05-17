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
// OpenRouter — modelos free + pagos, com fallback chain
// ============================================================================

/**
 * Cadeia de fallback para modelos free do OpenRouter.
 * Se um der 429/404, tenta o próximo. Lista ordenada por qualidade observada.
 */
const FALLBACK_CHAIN = [
  'deepseek/deepseek-v4-flash:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'minimax/minimax-m2.5:free',
]

class OpenRouterProvider implements LLMProvider {
  name = 'openrouter'

  private readonly apiKey: string
  private readonly defaultModel: string

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY ?? ''
    this.defaultModel = process.env.LAURA_LLM_MODEL ?? FALLBACK_CHAIN[0]
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY não configurada')
    }

    const primary = req.model ?? this.defaultModel
    const tried = new Set<string>()
    const queue = [primary, ...FALLBACK_CHAIN.filter((m) => m !== primary)]

    let lastErr: unknown = null
    for (const model of queue) {
      if (tried.has(model)) continue
      tried.add(model)
      try {
        return await this.callOnce(req, model)
      } catch (err) {
        lastErr = err
        const msg = err instanceof Error ? err.message : String(err)
        // 429 (rate limit) / 404 (modelo indisponível): tenta próximo
        if (msg.includes('429') || msg.includes('404')) continue
        throw err
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error('Todos os modelos OpenRouter falharam')
  }

  private async callOnce(
    req: ChatCompletionRequest,
    model: string,
  ): Promise<ChatCompletionResponse> {
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
      costUsd: 0,
      provider: 'openrouter',
      model,
    }
  }
}

// ============================================================================
// Groq — free tier alto (30 req/min) — fallback rápido
// ============================================================================
class GroqProvider implements LLMProvider {
  name = 'groq'

  private readonly apiKey: string
  private readonly defaultModel: string

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY ?? ''
    this.defaultModel = process.env.GROQ_LLM_MODEL ?? 'llama-3.3-70b-versatile'
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY não configurada')
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

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content ?? ''
    const usage = json.usage ?? {}

    return {
      content,
      tokensIn: usage.prompt_tokens ?? 0,
      tokensOut: usage.completion_tokens ?? 0,
      costUsd: 0,
      provider: 'groq',
      model,
    }
  }
}

// ============================================================================
// FallbackProvider — encadeia múltiplos providers
// ============================================================================
class FallbackProvider implements LLMProvider {
  name = 'fallback'

  constructor(private readonly providers: LLMProvider[]) {}

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    let lastErr: unknown = null
    for (const p of this.providers) {
      try {
        return await p.chat(req)
      } catch (err) {
        lastErr = err
        const msg = err instanceof Error ? err.message : String(err)
        // Continua tentando próximo provider em 429/quota/timeout/não configurado
        if (
          msg.includes('429') ||
          msg.includes('quota') ||
          msg.includes('rate') ||
          msg.includes('não configurada')
        ) {
          continue
        }
        throw err
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error('Todos os providers LLM falharam')
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
  const which = (process.env.LAURA_LLM_PROVIDER ?? 'auto').toLowerCase()

  // Mode 'auto' (default): encadeia todos os providers configurados em
  // ordem: Groq (mais rápido + free tier alto) → OpenRouter (free) → OpenAI (pago)
  if (which === 'auto') {
    const chain: LLMProvider[] = []
    if (process.env.GROQ_API_KEY) chain.push(new GroqProvider())
    if (process.env.OPENROUTER_API_KEY) chain.push(new OpenRouterProvider())
    if (process.env.OPENAI_API_KEY) chain.push(new OpenAIProvider())
    if (chain.length === 0) {
      cached = new MockProvider()
    } else if (chain.length === 1) {
      cached = chain[0]
    } else {
      cached = new FallbackProvider(chain)
    }
    return cached
  }

  switch (which) {
    case 'groq':
      cached = process.env.GROQ_API_KEY ? new GroqProvider() : new MockProvider()
      break
    case 'openai':
      cached = process.env.OPENAI_API_KEY ? new OpenAIProvider() : new MockProvider()
      break
    case 'mock':
      cached = new MockProvider()
      break
    case 'openrouter':
    default:
      cached = process.env.OPENROUTER_API_KEY
        ? new OpenRouterProvider()
        : new MockProvider()
  }
  return cached
}
