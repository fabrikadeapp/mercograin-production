/**
 * POST /api/admin/pricing/plans/[id]/features — adiciona feature
 */
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'
import { bumpPricingRevision } from '@/lib/pricing/sync'

export const dynamic = 'force-dynamic'

const schema = z.object({
  label: z.string().min(1),
  included: z.boolean().default(true),
  emphasis: z.boolean().default(false),
  sortOrder: z.number().int().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()
    const body = await req.json()
    const data = schema.parse(body)

    const plan = await db.plan.findUnique({ where: { id: params.id } })
    if (!plan) {
      return NextResponse.json({ error: 'plan_not_found' }, { status: 404 })
    }

    let sortOrder = data.sortOrder
    if (sortOrder == null) {
      const last = await db.planFeature.findFirst({
        where: { planId: plan.id },
        orderBy: { sortOrder: 'desc' },
      })
      sortOrder = (last?.sortOrder ?? -1) + 1
    }

    const feature = await db.planFeature.create({
      data: {
        planId: plan.id,
        label: data.label,
        included: data.included,
        emphasis: data.emphasis,
        sortOrder,
      },
    })

    await bumpPricingRevision()
    revalidatePath('/')
    revalidatePath('/precos')

    return NextResponse.json({ feature }, { status: 201 })
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
