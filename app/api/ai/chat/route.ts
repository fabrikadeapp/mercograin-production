import { NextRequest, NextResponse } from 'next/server'
import { getScope } from '@/lib/auth/scope'
import { getAiClient, AiNotAvailableError } from '@/lib/ai/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `Você é o assistente AI do PHB Grain — plataforma SaaS de originação,
fixação e gestão de risco para corretoras de grãos no Brasil. Responda em português,
de forma direta e prática. Quando o usuário pedir cálculos de hedge, BM&F, prêmio de
cidade ou contratos, peça os parâmetros que faltarem antes de calcular.`

/**
 * POST /api/ai/chat — endpoint de chat AI.
 *
 * Body: { messages: ChatMessage[] }
 * Response: { content: string, source: 'managed'|'byok', model: string }
 *
 * Erros:
 *   401 unauthorized
 *   402 ai_not_available  (plano não permite / sem chave BYOK / quota estourada)
 *   400 invalid_body
 *   500 upstream_error
 */
export async function POST(req: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as { messages?: ChatMessage[] } | null
    if (!body?.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    }

    // Sanitiza: aceita só role+content e limita tamanho
    const messages: ChatMessage[] = body.messages
      .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))

    if (messages.length === 0) {
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

    const completion = await resolved.client.chat.completions.create({
      model: resolved.model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.4,
      max_tokens: 1024,
    })

    const content = completion.choices[0]?.message?.content ?? ''

    return NextResponse.json({
      content,
      source: resolved.source,
      model: resolved.model,
      usage: completion.usage,
    })
  } catch (e: any) {
    console.error('[ai/chat POST]', e)
    return NextResponse.json(
      { error: 'upstream_error', message: e?.message || 'unknown' },
      { status: 500 },
    )
  }
}
