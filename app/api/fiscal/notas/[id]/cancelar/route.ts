import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/fiscal/providers'
import { z } from 'zod'

const cancelSchema = z.object({ motivo: z.string().min(15, 'Mínimo 15 caracteres') })

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  const parsed = cancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Motivo inválido', details: parsed.error.flatten() }, { status: 400 })
  }

  const nota = await db.notaFiscal.findFirst({ where: { id, ...scope.whereOwn() } })
  if (!nota) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
  if (nota.status !== 'autorizada') {
    return NextResponse.json({ error: `Não é possível cancelar nota com status '${nota.status}'` }, { status: 400 })
  }
  if (!nota.chave) {
    return NextResponse.json({ error: 'Nota sem chave de acesso' }, { status: 400 })
  }

  const provider = await getProvider(scope.workspaceId)
  const r = await provider.cancelarNFe(nota.chave, parsed.data.motivo)
  if (!r.ok) {
    return NextResponse.json({ error: r.erro ?? 'Falha no cancelamento' }, { status: 502 })
  }

  const updated = await db.notaFiscal.update({
    where: { id: nota.id },
    data: {
      status: 'cancelada',
      dataCancelamento: new Date(),
      motivoRejeicao: parsed.data.motivo,
      protocolo: r.protocolo ?? nota.protocolo,
    },
  })
  return NextResponse.json({ data: updated })
}
