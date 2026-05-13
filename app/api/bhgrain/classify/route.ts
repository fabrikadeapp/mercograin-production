/**
 * POST /api/bhgrain/classify
 *
 * Classifica um texto livre (sem persistir). Útil para debugging do
 * classificador e para jobs que processam mensagens em batch.
 *
 * Body: { text: string }
 * Resposta: ClassificationResult
 *
 * Não chama OpenAI se BH_GRAIN_AI_KEY não estiver setada — cai na heurística.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { classificarMensagem } from '@/lib/bhgrain/ai-classifier'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    await requireScope()
    const body = (await request.json().catch(() => ({}))) as { text?: string }
    const text = (body.text ?? '').toString().slice(0, 4000)
    if (!text) return NextResponse.json({ error: 'text obrigatório' }, { status: 400 })

    const result = await classificarMensagem(text, {
      openaiKey: process.env.OPENAI_API_KEY ?? null,
      model: process.env.BHGRAIN_AI_MODEL ?? 'gpt-4o-mini',
    })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    const status = msg === 'Não autorizado' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
