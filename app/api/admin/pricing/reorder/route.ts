/**
 * POST /api/admin/pricing/reorder
 *
 * Body:
 *   { kind: 'plan' | 'feature', items: [{ id, sortOrder }, ...] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'
import { bumpPricingRevision } from '@/lib/pricing/sync'

export const dynamic = 'force-dynamic'

const schema = z.object({
  kind: z.enum(['plan', 'feature']),
  items: z
    .array(
      z.object({
        id: z.string(),
        sortOrder: z.number().int(),
      })
    )
    .min(1),
})

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { kind, items } = schema.parse(await req.json())

    if (kind === 'plan') {
      await db.$transaction(
        items.map((it) =>
          db.plan.update({
            where: { id: it.id },
            data: { sortOrder: it.sortOrder },
          })
        )
      )
    } else {
      await db.$transaction(
        items.map((it) =>
          db.planFeature.update({
            where: { id: it.id },
            data: { sortOrder: it.sortOrder },
          })
        )
      )
    }

    await bumpPricingRevision()
    revalidatePath('/')
    revalidatePath('/precos')

    return NextResponse.json({ ok: true, count: items.length })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'validation', details: err.flatten() },
        { status: 400 }
      )
    }
    return adminErrorResponse(err)
  }
}
