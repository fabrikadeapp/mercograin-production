import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/fiscal/providers'

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await ctx.params

  const nota = await db.notaFiscal.findFirst({ where: { id, ...scope.whereOwn() } })
  if (!nota) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  if (!nota.chave) return NextResponse.json({ error: 'Nota não autorizada' }, { status: 400 })

  // Se já temos URL salva (Supabase Storage), redireciona direto
  if (nota.danfeUrl && !nota.danfeUrl.startsWith('mock://')) {
    return NextResponse.redirect(nota.danfeUrl)
  }

  const provider = await getProvider(scope.workspaceId)
  const r = await provider.baixarDANFE(nota.chave)
  if ('url' in r) return NextResponse.json({ url: r.url, mock: r.url.startsWith('mock://') })
  return new NextResponse(new Uint8Array(r as Buffer), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename=DANFE-${nota.chave}.pdf` },
  })
}
