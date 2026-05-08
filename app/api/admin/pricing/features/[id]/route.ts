/**
 * PUT    /api/admin/pricing/features/[id] — edita feature
 * DELETE /api/admin/pricing/features/[id] — deleta feature
 */
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'
import { bumpPricingRevision } from '@/lib/pricing/sync'

export const dynamic = 'force-dynamic'

const schema = z.object({
  label: z.string().min(1).optional(),
  included: z.boolean().optional(),
  emphasis: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()
    const data = schema.parse(await req.json())

    const feature = await db.planFeature.update({
      where: { id: params.id },
      data,
    })

    await bumpPricingRevision()
    revalidatePath('/')
    revalidatePath('/precos')

    return NextResponse.json({ feature })
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()
    await db.planFeature.delete({ where: { id: params.id } })

    await bumpPricingRevision()
    revalidatePath('/')
    revalidatePath('/precos')

    return NextResponse.json({ ok: true })
  } catch (err) {
    return adminErrorResponse(err)
  }
}
