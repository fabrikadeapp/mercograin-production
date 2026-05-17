import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Debug temporário — confere quais envs Laura.IA enxerga.
 * Removido após validação.
 */
export async function GET() {
  const auth = process.env.LAURA_INGEST_SECRET
  return NextResponse.json({
    LAURA_LLM_PROVIDER: process.env.LAURA_LLM_PROVIDER ?? '(unset)',
    LAURA_LLM_MODEL: process.env.LAURA_LLM_MODEL ?? '(unset)',
    OPENROUTER_API_KEY_set: !!process.env.OPENROUTER_API_KEY,
    OPENROUTER_API_KEY_prefix: process.env.OPENROUTER_API_KEY?.slice(0, 12) ?? '',
    LAURA_INGEST_SECRET_set: !!auth,
    nodeEnv: process.env.NODE_ENV,
  })
}
