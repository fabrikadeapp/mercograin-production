import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Apenas owner do workspace pode finalizar onboarding
    const ws = await db.workspace.findFirst({
      where: { id: scope.workspaceId, ownerId: scope.userId },
    })
    if (!ws) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // Garantir que tenha empresa cadastrada (mínimo)
    const empresa = await db.dadosEmpresa.findUnique({
      where: { workspaceId: ws.id },
    })
    if (!empresa || !empresa.razaoSocial) {
      return NextResponse.json(
        { error: 'empresa_required', message: 'Cadastre os dados da empresa primeiro' },
        { status: 400 }
      )
    }

    const updated = await db.workspace.update({
      where: { id: ws.id },
      data: { onboardingCompletedAt: new Date() },
    })

    return NextResponse.json({ ok: true, onboardingCompletedAt: updated.onboardingCompletedAt })
  } catch (e: any) {
    console.error('[onboarding/complete]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
