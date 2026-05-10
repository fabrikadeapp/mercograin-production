/**
 * GET /api/whatsapp/status
 * Retorna estado da instance Evolution do workspace + dados de perfil.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireScope } from '@/lib/auth/scope'
import { db } from '@/lib/db'
import {
  getConnectionState,
  fetchInstanceProfile,
  EvolutionError,
} from '@/lib/whatsapp/evolution'
import { getInstanceForWorkspace } from '@/lib/whatsapp/instance-resolver'

export async function GET(_request: NextRequest) {
  try {
    const scope = await requireScope()
    const wsInstance = await getInstanceForWorkspace(scope.workspaceId)
    if (!wsInstance) {
      return NextResponse.json({
        status: 'close',
        ownerJid: null,
        profileName: null,
        profilePicUrl: null,
        phoneNumber: null,
        instanceName: null,
        provisioned: false,
      })
    }

    const state = await getConnectionState(wsInstance.instanceName)
    let profileName = wsInstance.profileName ?? state.profileName ?? null
    let profilePicUrl = wsInstance.profilePicUrl ?? state.profilePicUrl ?? null
    let ownerJid = wsInstance.phoneJid ?? state.ownerJid ?? null
    let phoneNumber = wsInstance.phoneNumber ?? null

    // Conectado — buscar profile completo se ainda não temos
    if (state.status === 'open' && (!profileName || !profilePicUrl || !phoneNumber)) {
      const profile = await fetchInstanceProfile(wsInstance.instanceName).catch(
        () => null
      )
      if (profile) {
        profileName = profile.profileName ?? profileName
        profilePicUrl = profile.profilePicUrl ?? profilePicUrl
        ownerJid = profile.ownerJid ?? ownerJid
        phoneNumber = ownerJid ? ownerJid.split('@')[0] : phoneNumber
      }
    }

    // Sincroniza DB se houve mudança ou novo connect
    const dbStatus =
      state.status === 'open'
        ? 'connected'
        : state.status === 'connecting'
          ? 'connecting'
          : 'disconnected'
    if (
      dbStatus !== wsInstance.status ||
      profileName !== wsInstance.profileName ||
      profilePicUrl !== wsInstance.profilePicUrl ||
      ownerJid !== wsInstance.phoneJid
    ) {
      await db.whatsAppInstance
        .update({
          where: { id: wsInstance.id },
          data: {
            status: dbStatus,
            ...(profileName ? { profileName } : {}),
            ...(profilePicUrl ? { profilePicUrl } : {}),
            ...(ownerJid
              ? { phoneJid: ownerJid, phoneNumber }
              : {}),
            ...(state.status === 'open' && !wsInstance.connectedAt
              ? { connectedAt: new Date() }
              : {}),
            ...(state.status !== 'open' && wsInstance.status === 'connected'
              ? { disconnectedAt: new Date() }
              : {}),
          },
        })
        .catch(() => undefined)
    }

    return NextResponse.json({
      status: state.status,
      ownerJid,
      profileName,
      profilePicUrl,
      phoneNumber,
      instanceName: wsInstance.instanceName,
      provisioned: true,
    })
  } catch (error) {
    const status = error instanceof EvolutionError ? error.status : 500
    const message =
      error instanceof Error ? error.message : 'Erro ao obter status'
    if (message === 'Não autorizado') {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    console.error('[whatsapp/status] erro:', message)
    return NextResponse.json(
      { error: message, status },
      { status: status >= 400 && status < 600 ? status : 500 }
    )
  }
}
