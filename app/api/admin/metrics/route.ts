import { NextResponse } from 'next/server'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'
import { calcularMetricas } from '@/lib/admin/metrics'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
    const metrics = await calcularMetricas()
    return NextResponse.json(metrics)
  } catch (e) {
    return adminErrorResponse(e)
  }
}
