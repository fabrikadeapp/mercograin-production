import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await ctx.params

  const nota = await db.notaFiscal.findFirst({
    where: { id, ...scope.whereOwn() },
    include: {
      contrato: { select: { id: true, numero: true } },
      cartasCorrecao: { orderBy: { sequencia: 'asc' } },
    },
  })
  if (!nota) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  return NextResponse.json({ data: nota })
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await ctx.params

  const nota = await db.notaFiscal.findFirst({ where: { id, ...scope.whereOwn() } })
  if (!nota) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  if (nota.status !== 'rascunho') {
    return NextResponse.json({ error: 'Só é possível excluir notas em rascunho. Use cancelamento para notas autorizadas.' }, { status: 400 })
  }
  await db.notaFiscal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
