import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { processIncomingMessage } from '@/lib/laura/process-message'
import { checkMutationLimit, rateLimited } from '@/lib/security/mutation-rate-limit'
import { getClientIp } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  workspaceId: z.string().min(1),
  canal: z.enum(['whatsapp', 'telefone', 'webchat']),
  handle: z.string().min(1),
  mensagem: z.string().min(1),
  tipo: z.enum(['text', 'audio', 'image', 'document']).optional(),
  transcricao: z.string().optional(),
})

/**
 * POST /api/laura/ingest
 *
 * Endpoint genérico para alimentar Laura.IA com mensagens de qualquer canal.
 * Usado por:
 *  - Webhook Evolution (WhatsApp) — adapter mapeia evento → este formato
 *  - Twilio voice webhook (telefone) — transcrição Whisper + handle
 *  - Webchat futuro
 *
 * Auth: Bearer LAURA_INGEST_SECRET ou cookie de sessão admin.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.LAURA_INGEST_SECRET
  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  // Rate limit por IP (webhook externo)
  const ip = getClientIp(req)
  const limit = checkMutationLimit('laura.ingest', ip)
  if (!limit.ok) return rateLimited(limit)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'invalid' },
      { status: 400 },
    )
  }

  try {
    const result = await processIncomingMessage(parsed.data)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[laura.ingest]', err)
    return NextResponse.json(
      {
        error: 'process_failed',
        message: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    )
  }
}
