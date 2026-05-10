/**
 * DELETE /api/whatsapp/disconnect
 * Faz logout da instance Evolution do workspace.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import { logout, EvolutionError } from '@/lib/whatsapp/evolution'
import { getInstanceForWorkspace } from '@/lib/whatsapp/instance-resolver'

export async function DELETE(_request: NextRequest) {
  try {
    const scope = await requireScope()
    const wsInstance = await getInstanceForWorkspace(scope.workspaceId)
    if (!wsInstance) {
      return NextResponse.json({ success: true, message: 'Sem instância ativa' })
    }
    await logout(wsInstance.instanceName)
    await db.whatsAppInstance.update({
      where: { id: wsInstance.id },
      data: {
        status: 'disconnected',
        disconnectedAt: new Date(),
      },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const status = error instanceof EvolutionError ? error.status : 500
    const message =
      error instanceof Error ? error.message : 'Erro ao desconectar'
    if (message === 'Não autorizado') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    console.error('[whatsapp/disconnect] erro:', message)
    return NextResponse.json(
      { error: message, status },
      { status: status >= 400 && status < 600 ? status : 500 }
    )
  }
}
