/**
 * Admin: lista e gera signed URL para backups Postgres.
 *
 * GET  → lista arquivos do bucket privado phb-grain-backups
 * POST → recebe { name } e retorna signed URL (1h) para download
 *
 * Bucket é PRIVADO — service_role key necessária. Acesso só via requireAdmin.
 */
import { NextResponse } from 'next/server'
import { requireAdmin, adminErrorResponse } from '@/lib/auth/admin'
import { listFiles, getSignedUrl } from '@/lib/supabase/storage'

export const dynamic = 'force-dynamic'

const BUCKET = 'phb-grain-backups'

export async function GET() {
  try {
    await requireAdmin()
    const files = await listFiles(BUCKET)
    return NextResponse.json({
      backups: files
        .map((f) => ({
          name: f.name,
          size:
            (f.metadata as { size?: number } | null | undefined)?.size ?? null,
          createdAt: f.created_at ?? null,
        }))
        .sort((a, b) =>
          (b.createdAt || '').localeCompare(a.createdAt || ''),
        ),
    })
  } catch (err) {
    return adminErrorResponse(err)
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin()
    const body = (await req.json().catch(() => null)) as { name?: unknown } | null
    const name = body?.name
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    // Defesa: só permite arquivos com prefixo esperado
    if (!/^phb-grain-[\w\-:.]+\.sql\.gz$/.test(name)) {
      return NextResponse.json({ error: 'invalid name' }, { status: 400 })
    }
    const url = await getSignedUrl(BUCKET, name, 3600)
    return NextResponse.json({ url, expiresIn: 3600 })
  } catch (err) {
    return adminErrorResponse(err)
  }
}
