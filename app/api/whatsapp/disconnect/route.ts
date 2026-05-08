/**
 * DELETE /api/whatsapp/disconnect
 * Faz logout da instance Evolution.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { logout, EvolutionError } from '@/lib/whatsapp/evolution'

export async function DELETE(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    await logout()
    return NextResponse.json({ success: true })
  } catch (error) {
    const status = error instanceof EvolutionError ? error.status : 500
    const message =
      error instanceof Error ? error.message : 'Erro ao desconectar'
    console.error('[whatsapp/disconnect] erro:', message)
    return NextResponse.json(
      { error: message, status },
      { status: status >= 400 && status < 600 ? status : 500 }
    )
  }
}
