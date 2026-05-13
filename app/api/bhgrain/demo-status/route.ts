/**
 * GET /api/bhgrain/demo-status — público (apenas indica se modo demo está ativo).
 * Não retorna nenhum dado sensível.
 */

import { NextResponse } from 'next/server'
import { isDemoModeEnabled } from '@/lib/bhgrain/demo-mode'

export const dynamic = 'force-dynamic'

export async function GET() {
  const enabled = await isDemoModeEnabled().catch(() => false)
  return NextResponse.json({ enabled })
}
