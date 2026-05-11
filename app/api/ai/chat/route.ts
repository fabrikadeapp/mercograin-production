import { NextRequest, NextResponse } from 'next/server'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import { getScope } from '@/lib/auth/scope'
import { getAiClient, AiNotAvailableError } from '@/lib/ai/client'
import { getQuote } from '@/lib/quotes/registry'
import type { QuoteLabel } from '@/lib/quotes/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `Você é o assistente AI do PHB Grain — plataforma SaaS de originação,
fixação e gestão de risco para corretoras de grãos no Brasil. Responda em português,
de forma direta e prática. Quando precisar de cotação atual de soja, milho, trigo ou
USD/BRL para fazer cálculos, USE a ferramenta get_quote — não invente números.
Quando o usuário pedir cálculos de hedge, BM&F, prêmio de cidade ou contratos, peça
os parâmetros que faltarem antes de calcular.`

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_quote',
      description:
        'Retorna a cotação atual de um ativo (soja, milho, trigo CBOT ou câmbio USD/BRL). ' +
        'Soja/milho/trigo retornam em R$/sc 60kg (CEPEA) ou USD/bu (CBOT) dependendo do provider. ' +
        'USD/BRL retorna em BRL. Use SEMPRE que precisar de número atual.',
      parameters: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            enum: ['soja', 'milho', 'trigo', 'usdbrl'],
            description: 'Qual ativo consultar.',
          },
        },
        required: ['label'],
      },
    },
  },
]

async function runToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  if (name === 'get_quote') {
    const label = args.label as QuoteLabel
    const result = await getQuote(label)
    if (!result) {
      return JSON.stringify({ ok: false, error: 'sem cotação disponível agora' })
    }
    const { quote, source } = result
    return JSON.stringify({
      ok: true,
      label,
      price: quote.price,
      currency: quote.currency,
      symbol: quote.symbol,
      exchange: quote.exchangeName,
      previousClose: quote.previousClose,
      changePct: quote.changePct,
      fetchedAt: quote.fetchedAt,
      source,
    })
  }
  return JSON.stringify({ ok: false, error: `tool desconhecida: ${name}` })
}

/**
 * POST /api/ai/chat — endpoint de chat AI com function calling.
 *
 * Body: { messages: ChatMessage[] }
 * Response: { content, source, model }
 *
 * Loop de tool calls com cap de 4 rounds para evitar runaway.
 */
export async function POST(req: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = (await req.json().catch(() => null)) as { messages?: ChatMessage[] } | null
    if (!body?.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    }

    const userMessages = body.messages
      .filter(
        (m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'),
      )
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))

    if (userMessages.length === 0) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    }

    let resolved
    try {
      resolved = await getAiClient(scope.workspaceId)
    } catch (e) {
      if (e instanceof AiNotAvailableError) {
        return NextResponse.json(
          { error: 'ai_not_available', reason: e.code, message: e.message },
          { status: 402 },
        )
      }
      throw e
    }

    const conversation: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...userMessages.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
    ]

    const MAX_ROUNDS = 4
    let finalContent = ''
    let lastUsage: unknown = null

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const completion = await resolved.client.chat.completions.create({
        model: resolved.model,
        messages: conversation,
        tools: TOOLS,
        temperature: 0.4,
        max_tokens: 1024,
      })

      lastUsage = completion.usage
      const choice = completion.choices[0]
      const msg = choice?.message
      if (!msg) break

      // Se modelo pediu tool(s), executa cada uma e segue o loop
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        conversation.push(msg)
        for (const tc of msg.tool_calls) {
          if (tc.type !== 'function') continue
          let parsedArgs: Record<string, unknown> = {}
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}')
          } catch {
            /* mantém vazio */
          }
          const out = await runToolCall(tc.function.name, parsedArgs)
          conversation.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: out,
          })
        }
        continue
      }

      // Sem tool call → resposta final
      finalContent = msg.content ?? ''
      break
    }

    return NextResponse.json({
      content: finalContent,
      source: resolved.source,
      model: resolved.model,
      usage: lastUsage,
    })
  } catch (e: any) {
    console.error('[ai/chat POST]', e)
    return NextResponse.json(
      { error: 'upstream_error', message: e?.message || 'unknown' },
      { status: 500 },
    )
  }
}
