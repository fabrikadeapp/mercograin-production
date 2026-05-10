import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await ctx.params

  const sped = await db.spedExport.findFirst({ where: { id, ...scope.whereOwn() } })
  if (!sped) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (sped.status !== 'pronto' || !sped.arquivoUrl) {
    return NextResponse.json({ error: 'Arquivo ainda não disponível' }, { status: 409 })
  }

  // arquivoUrl pode ser data: ou URL externa (Supabase Storage)
  if (sped.arquivoUrl.startsWith('data:')) {
    const base64 = sped.arquivoUrl.split(',')[1]
    const buf = Buffer.from(base64, 'base64')
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename=SPED-${sped.tipo}-${sped.competencia}.txt`,
      },
    })
  }
  return NextResponse.redirect(sped.arquivoUrl)
}
