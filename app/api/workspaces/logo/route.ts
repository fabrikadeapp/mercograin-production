import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'])

function canManage(role: string | undefined, isAdmin: boolean) {
  if (isAdmin) return true
  return role === 'owner' || role === 'admin'
}

/**
 * POST — upload da logo da workspace.
 * Apenas owner/admin do workspace (ou superadmin global) pode subir.
 *
 * Storage: filesystem local em public/uploads/logos/.
 * AVISO: Railway tem filesystem efêmero — uploads se perdem em deploys novos.
 * Fallback automático para data URL inline (base64) caso FS write falhe.
 * Dívida técnica: migrar para Railway Volume ou Cloudflare R2/S3.
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
    const extMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/svg+xml': 'svg',
    }
    const ext = extMap[file.type] || 'png'
    const filename = `${scope.workspaceId}-${Date.now()}.${ext}`

    let url: string
    try {
      const dir = path.join(process.cwd(), 'public', 'uploads', 'logos')
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(path.join(dir, filename), buffer)
      url = `/uploads/logos/${filename}`
    } catch (fsErr) {
      console.warn('[workspaces/logo] FS write falhou, usando data URL:', fsErr)
      url = `data:${file.type};base64,${buffer.toString('base64')}`
    }

    await db.dadosEmpresa.upsert({
      where: { workspaceId: scope.workspaceId },
      create: {
        workspaceId: scope.workspaceId,
        razaoSocial: 'Empresa',
        logoUrl: url,
        logoUploadedAt: new Date(),
      },
      update: { logoUrl: url, logoUploadedAt: new Date() },
    })

    return NextResponse.json({ url })
  } catch (e: any) {
    console.error('[workspaces/logo POST]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}

/**
 * DELETE — remove logo customizada (volta a usar a default PHB Grain).
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

    // Tenta remover arquivo do FS (best effort)
    if (empresa.logoUrl && empresa.logoUrl.startsWith('/uploads/logos/')) {
      try {
        const filePath = path.join(process.cwd(), 'public', empresa.logoUrl)
        await fs.unlink(filePath)
      } catch {
        // ignora — arquivo pode já ter sumido em deploy efêmero
      }
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
