import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/fiscal/providers'
import { z } from 'zod'

const cceSchema = z.object({ texto: z.string().min(15).max(1000) })

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  const parsed = cceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Texto inválido', details: parsed.error.flatten() }, { status: 400 })
  }

  const nota = await db.notaFiscal.findFirst({
    where: { id, ...scope.whereOwn() },
    include: { cartasCorrecao: true },
  })
  if (!nota) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  if (nota.status !== 'autorizada') {
    return NextResponse.json({ error: 'Só é possível emitir CC-e para nota autorizada' }, { status: 400 })
  }
  if (!nota.chave) {
    return NextResponse.json({ error: 'Nota sem chave de acesso' }, { status: 400 })
  }
  const sequencia = (nota.cartasCorrecao?.length ?? 0) + 1
  if (sequencia > 20) {
    return NextResponse.json({ error: 'Máximo 20 cartas de correção por NF-e' }, { status: 400 })
  }

  const provider = await getProvider(scope.workspaceId)
  const r = await provider.enviarCartaCorrecao(nota.chave, parsed.data.texto, sequencia)

  const cce = await db.cartaCorrecao.create({
    data: {
      workspaceId: scope.workspaceId,
      notaFiscalId: nota.id,
      sequencia,
      texto: parsed.data.texto,
      status: r.ok ? 'aceita' : 'rejeitada',
      protocolo: r.protocolo ?? null,
      motivo: r.ok ? null : (r.erro ?? null),
      dataAceite: r.ok ? new Date() : null,
    },
  })
  return NextResponse.json({ data: cce, providerResult: r }, { status: r.ok ? 200 : 502 })
}
