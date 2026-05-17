import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'
import { auth } from '@/auth'
import { FEATURES, loadFeaturesFor, setFeature, type FeatureKey } from '@/lib/features'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  feature: z.string(),
  enabled: z.boolean(),
  notes: z.string().optional(),
})

/**
 * GET /api/admin/workspaces/[id]/features
 * Lista todas as features do workspace com estado atual.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin()
    const workspace = await db.workspace.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, codigo: true },
    })
    if (!workspace) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    const state = await loadFeaturesFor(params.id)
    return NextResponse.json({
      workspace,
      catalog: FEATURES,
      state,
    })
  } catch (err) {
    return adminErrorResponse(err)
  }
}

/**
 * PATCH /api/admin/workspaces/[id]/features
 * { feature: 'eudr', enabled: true, notes?: '...' }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin()
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'invalid' },
        { status: 400 },
      )
    }

    if (!(parsed.data.feature in FEATURES)) {
      return NextResponse.json({ error: 'feature_unknown' }, { status: 400 })
    }

    await setFeature({
      workspaceId: params.id,
      feature: parsed.data.feature as FeatureKey,
      enabled: parsed.data.enabled,
      byUserId: session.user.id,
      notes: parsed.data.notes,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return adminErrorResponse(err)
  }
}
