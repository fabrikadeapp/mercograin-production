import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isSaida } from '@/lib/operacao-fisica/lote-balance'

const movSchema = z.object({
  tipo: z.enum(['entrada', 'saida', 'transferencia', 'quebra_tecnica', 'rebaixe']),
  qtdSc: z.coerce.number().positive(),
  armazemDestinoId: z.string().optional().nullable(),
  ticketBalancaId: z.string().optional().nullable(),
  contratoId: z.string().optional().nullable(),
  motivo: z.string().optional().nullable(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const lote = await db.loteEstoque.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!lote) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
  const data = await db.movimentacaoLote.findMany({
    where: { loteId: params.id, ...scope.whereOwn() },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  return NextResponse.json({ data })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await request.json()
    const data = movSchema.parse(body)
    const lote = await db.loteEstoque.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!lote) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })

    if (isSaida(data.tipo) && data.qtdSc > lote.qtdAtualSc) {
      return NextResponse.json(
        { error: `Saldo insuficiente (atual=${lote.qtdAtualSc}sc)` },
        { status: 400 }
      )
    }

    const result = await db.$transaction(async (tx) => {
      const mov = await tx.movimentacaoLote.create({
        data: {
          workspaceId: scope.workspaceId,
          loteId: lote.id,
          tipo: data.tipo,
          qtdSc: data.qtdSc,
          armazemDestinoId: data.armazemDestinoId || null,
          ticketBalancaId: data.ticketBalancaId || null,
          contratoId: data.contratoId || null,
          motivo: data.motivo || null,
        },
      })
      const delta = isSaida(data.tipo) ? -data.qtdSc : data.qtdSc
      const novoSaldo = lote.qtdAtualSc + delta
      const novoStatus = novoSaldo <= 0 ? 'consumido' : lote.status
      await tx.loteEstoque.update({
        where: { id: lote.id },
        data: { qtdAtualSc: novoSaldo, status: novoStatus },
      })
      // Se transferência com armazemDestinoId, cria lote-destino espelho
      if (data.tipo === 'transferencia' && data.armazemDestinoId) {
        await tx.loteEstoque.create({
          data: {
            numero: `${lote.numero}-T${Date.now().toString().slice(-5)}`,
            cultura: lote.cultura,
            safraId: lote.safraId,
            armazemId: data.armazemDestinoId,
            qtdInicialSc: data.qtdSc,
            qtdAtualSc: data.qtdSc,
            umidadeMedia: lote.umidadeMedia,
            impurezaMedia: lote.impurezaMedia,
            workspaceId: scope.workspaceId,
          },
        })
      }
      return mov
    })
    return NextResponse.json(result, { status: 201 })
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: e.errors[0].message }, { status: 400 })
    console.error('POST mov error', e)
    return NextResponse.json({ error: 'Erro' }, { status: 500 })
  }
}
