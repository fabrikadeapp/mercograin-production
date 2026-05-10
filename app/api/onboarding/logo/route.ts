import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import {
  uploadImage,
  deleteImage,
  isSupabaseUrl,
  getExtensionForMime,
} from '@/lib/supabase/storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_SIZE = 500 * 1024 // 500KB (onboarding tem limite menor)
const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
])

export async function POST(req: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'no_file' }, { status: 400 })
    }
    if (!ALLOWED_MIMES.has(file.type)) {
      return NextResponse.json(
        { error: 'invalid_type', allowed: Array.from(ALLOWED_MIMES) },
        { status: 400 }
      )
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'too_large', max: MAX_SIZE }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = getExtensionForMime(file.type)
    const fileName = `${scope.workspaceId}-${Date.now()}.${ext}`

    // Limpa Supabase antiga, se houver (idempotência durante onboarding)
    const existing = await db.dadosEmpresa.findUnique({
      where: { workspaceId: scope.workspaceId },
      select: { logoUrl: true },
    })
    if (existing?.logoUrl && isSupabaseUrl(existing.logoUrl)) {
      await deleteImage(existing.logoUrl)
    }

    const { publicUrl } = await uploadImage({
      buffer,
      mimeType: file.type,
      pathPrefix: 'logos',
      fileName,
    })

    await db.dadosEmpresa.upsert({
      where: { workspaceId: scope.workspaceId },
      create: {
        workspaceId: scope.workspaceId,
        razaoSocial: 'Empresa',
        logoUrl: publicUrl,
      },
      update: { logoUrl: publicUrl },
    })

    return NextResponse.json({ url: publicUrl })
  } catch (e: any) {
    console.error('[onboarding/logo]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
