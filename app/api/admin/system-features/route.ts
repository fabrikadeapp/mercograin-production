/**
 * GET  /api/admin/system-features    → snapshot dos kill-switches globais
 * PUT  /api/admin/system-features    → body: { feature, enabled, notes? }
 *
 * Acesso restrito a User.role === 'admin' (super-admin).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'
import {
  FEATURES,
  loadSystemFlags,
  setSystemFlag,
  type FeatureKey,
} from '@/lib/features'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdmin()
    const flags = await loadSystemFlags()
    const items = (Object.keys(FEATURES) as FeatureKey[]).map((k) => ({
      key: k,
      label: FEATURES[k].label,
      description: FEATURES[k].description,
      core: FEATURES[k].core,
      enabled: flags[k].enabled,
      toggledAt: flags[k].toggledAt,
      toggledBy: flags[k].toggledBy,
    }))
    return NextResponse.json({ ok: true, features: items })
  } catch (err) {
    return adminErrorResponse(err)
  }
}

const putSchema = z.object({
  feature: z.string().min(1),
  enabled: z.boolean(),
  notes: z.string().max(500).optional(),
})

export async function PUT(req: NextRequest) {
  try {
    const u = await requireAdmin()

    const parsed = putSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    }
    const key = parsed.data.feature as FeatureKey
    if (!FEATURES[key]) {
      return NextResponse.json({ error: 'feature_desconhecida' }, { status: 400 })
    }
    if (FEATURES[key].core) {
      return NextResponse.json({ error: 'feature_core_nao_toggle' }, { status: 400 })
    }
    await setSystemFlag({
      feature: key,
      enabled: parsed.data.enabled,
      byUserId: u.id,
      notes: parsed.data.notes,
    })
    await logAudit({
      userId: u.id,
      workspaceId: 'system',
      acao: parsed.data.enabled ? 'feature_enable' : 'feature_disable',
      entidade: 'SystemFeatureFlag',
      entidadeId: key,
      mudancas: { enabled: parsed.data.enabled, notes: parsed.data.notes },
    }).catch(() => undefined)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return adminErrorResponse(err)
  }
}
