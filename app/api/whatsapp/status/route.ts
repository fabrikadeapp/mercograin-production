/**
 * GET /api/whatsapp/status
 * Retorna estado da instance Evolution dedicada ao PHB Grain.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  getConnectionState,
  EvolutionError,
} from '@/lib/whatsapp/evolution'

export async function GET(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const state = await getConnectionState()
    return NextResponse.json({
      status: state.status,
      ownerJid: state.ownerJid ?? null,
      profileName: state.profileName ?? null,
      instanceName: state.instanceName,
    })
  } catch (error) {
    const status = error instanceof EvolutionError ? error.status : 500
    const message =
      error instanceof Error ? error.message : 'Erro ao obter status'
    console.error('[whatsapp/status] erro:', message)
    return NextResponse.json(
      { error: message, status },
      { status: status >= 400 && status < 600 ? status : 500 }
    )
  }
}
