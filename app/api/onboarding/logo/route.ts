import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_SIZE = 500 * 1024 // 500KB

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
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'too_large', max: MAX_SIZE }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = (file.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '')
    const filename = `${scope.workspaceId}-${Date.now()}.${ext}`

    let url: string
    try {
      const dir = path.join(process.cwd(), 'public', 'uploads', 'logos')
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(path.join(dir, filename), buffer)
      url = `/uploads/logos/${filename}`
    } catch (fsErr) {
      // Fallback: data URL inline (Railway pode ter FS read-only)
      console.warn('[onboarding/logo] FS write failed, using data URL:', fsErr)
      url = `data:${file.type};base64,${buffer.toString('base64')}`
    }

    // Update DadosEmpresa.logoUrl
    await db.dadosEmpresa.upsert({
      where: { workspaceId: scope.workspaceId },
      create: {
        workspaceId: scope.workspaceId,
        razaoSocial: 'Empresa',
        logoUrl: url,
      },
      update: { logoUrl: url },
    })

    return NextResponse.json({ url })
  } catch (e: any) {
    console.error('[onboarding/logo]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
