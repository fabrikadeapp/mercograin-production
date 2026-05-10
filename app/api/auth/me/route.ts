import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const u = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      nome: true,
      role: true,
      emailVerificado: true,
      totpEnabled: true,
      totpVerifiedAt: true,
    },
  })
  if (!u) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(u)
}
