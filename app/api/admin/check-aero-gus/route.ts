import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({}, { status: 401 })
  }
  const u = await db.user.findFirst({
    where: { email: 'aero.gus@hotmail.com' },
    select: {
      id: true,
      email: true,
      nome: true,
      role: true,
      totpEnabled: true,
      totpSecret: true,
      emailVerified: true,
      workspaceMemberships: { select: { workspaceId: true, role: true } },
    },
  })
  // Super-admins (role=admin) cadastrados
  const admins = await db.user.findMany({
    where: { role: 'admin' },
    select: { id: true, email: true, nome: true, totpEnabled: true, workspaceMemberships: { select: { id: true } } },
  })
  return NextResponse.json({ aero: u, totalAdmins: admins.length, admins })
}
