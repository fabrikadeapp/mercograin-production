/**
 * GET /api/portal/[slug]/info — PÚBLICO (sem auth).
 *
 * Retorna apenas dados públicos da corretora identificada pelo slug, para a
 * página de captação de lead exibir marca/nome. NÃO expõe ownerId, assinatura,
 * e-mails internos ou qualquer dado sensível.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const ws = await db.workspace.findUnique({
    where: { slug: params.slug },
    select: {
      name: true,
      slug: true,
      empresa: { select: { nomeFantasia: true, razaoSocial: true, logoUrl: true } },
    },
  })
  if (!ws) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({
    ok: true,
    corretora: {
      nome: ws.empresa?.nomeFantasia || ws.empresa?.razaoSocial || ws.name,
      slug: ws.slug,
      logoUrl: ws.empresa?.logoUrl ?? null,
    },
  })
}
