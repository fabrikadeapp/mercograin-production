import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { resolveContentMock } from '@/lib/contratos/render-template'
import { buildMockContext } from '@/lib/contratos/template-vars'
import { renderTemplateToPdfBuffer } from '@/lib/contratos/pdf-renderer'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const template = await db.contratoTemplate.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!template) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const mock = buildMockContext()
    const resolved = resolveContentMock(template.contentJson, mock)
    const buffer = await renderTemplateToPdfBuffer(resolved)

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="preview-${template.nome
          .replace(/[^a-z0-9]+/gi, '-')
          .toLowerCase()}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    console.error('[templates preview]', e)
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 })
  }
}
