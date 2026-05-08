/**
 * Admin auth helper.
 *
 * `requireAdmin` retorna o user autenticado se ele tem role='admin',
 * caso contrário lança um Error com `statusCode` (401/403) que pode ser
 * convertido em NextResponse pelo handler.
 */
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export interface AdminUser {
  id: string
  email: string
  nome: string
  role: string
}

export class AdminAuthError extends Error {
  statusCode: number
  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
  }
}

export async function requireAdmin(): Promise<AdminUser> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new AdminAuthError('unauthorized', 401)
  }
  const u = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, nome: true, role: true },
  })
  if (!u || u.role !== 'admin') {
    throw new AdminAuthError('forbidden', 403)
  }
  return u
}

export function adminErrorResponse(err: unknown): NextResponse {
  if (err instanceof AdminAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode })
  }
  console.error('[admin]', err)
  return NextResponse.json({ error: 'internal_error' }, { status: 500 })
}
