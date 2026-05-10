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

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
])

function canManage(role: string | undefined, isAdmin: boolean) {
  if (isAdmin) return true
  return role === 'owner' || role === 'admin'
}

/**
 * POST — upload da logo da workspace.
 * Apenas owner/admin do workspace (ou superadmin global) pode subir.
 *
 * Storage: Supabase Storage (bucket phb-grain-uploads, pasta logos/).
 * Substitui o filesystem local (efêmero no Railway) e o fallback data-URL.
 *
 * Retrocompatibilidade: logos antigas em /uploads/... ou data: continuam
 * renderizando até o usuário re-uploadar (migração lazy).
 */
export async function POST(req: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    if (!canManage(scope.workspaceRole, scope.isAdmin)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
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

    // Limpar logo Supabase antiga (se existir) antes de subir nova
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
        logoUploadedAt: new Date(),
      },
      update: { logoUrl: publicUrl, logoUploadedAt: new Date() },
    })

    return NextResponse.json({ url: publicUrl })
  } catch (e: any) {
    console.error('[workspaces/logo POST]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}

/**
 * DELETE — remove logo customizada (volta a usar a default BH Grain).
 */
export async function DELETE() {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    if (!canManage(scope.workspaceRole, scope.isAdmin)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const empresa = await db.dadosEmpresa.findUnique({
      where: { workspaceId: scope.workspaceId },
    })
    if (!empresa) {
      return NextResponse.json({ ok: true })
    }

    // Best-effort: deleta arquivo no Supabase. URLs antigas (/uploads/ ou data:)
    // não há o que apagar — apenas zera o campo no DB.
    if (empresa.logoUrl && isSupabaseUrl(empresa.logoUrl)) {
      await deleteImage(empresa.logoUrl)
    }

    await db.dadosEmpresa.update({
      where: { workspaceId: scope.workspaceId },
      data: { logoUrl: null, logoUploadedAt: null },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[workspaces/logo DELETE]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}

/**
 * GET — retorna logoUrl atual da workspace (qualquer member pode ver).
 */
export async function GET() {
  try {
    const scope = await getScope()
    if (!scope) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const empresa = await db.dadosEmpresa.findUnique({
      where: { workspaceId: scope.workspaceId },
      select: { logoUrl: true, logoUploadedAt: true },
    })
    return NextResponse.json({
      logoUrl: empresa?.logoUrl ?? null,
      logoUploadedAt: empresa?.logoUploadedAt ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
