import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const planoSchema = z.object({
  cultura: z.string().min(1),
  safraId: z.string().optional(),
  qtdPrevistaSc: z.number().positive(),
  precoMedioPrevistoSc: z.number().positive().optional(),
  observacoes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const cultura = searchParams.get('cultura') || ''
  const status = searchParams.get('status') || ''

  const where: any = scope.whereOwn()
  if (cultura) where.cultura = cultura
  if (status) where.status = status

  const planos = await db.planoVendas.findMany({
    where,
    include: { safra: { select: { id: true, nome: true, ativa: true } } },
    orderBy: { createdAt: 'desc' },
  })

  // Recalcular contratado/fixado/entregue em runtime para refletir realidade.
  const enriched = await Promise.all(
    planos.map(async (p) => {
      // Contratado: soma volumeSc das propostas vinculadas a contratos da safra/cultura
      // (heurística simples: todos os contratos do workspace cuja proposta tem mesmo grão).
      const contratos = await db.contrato.findMany({
        where: {
          ...scope.whereOwn(),
          statusAssinatura: { not: 'cancelado' },
        },
        select: {
          id: true,
          fixacao: { select: { qtdFixadaSc: true } },
          proposta: { select: { graos: true } },
        },
      })
      let qtdContratada = 0
      let qtdFixada = 0
      for (const c of contratos) {
        const graos = (c.proposta?.graos as any) || []
        if (!Array.isArray(graos)) continue
        for (const g of graos) {
          const grao = String(g.grao || g.label || '').toLowerCase()
          if (grao === p.cultura.toLowerCase()) {
            qtdContratada += Number(g.volumeSc ?? g.quantidadeSc ?? 0)
          }
        }
        if (c.fixacao) qtdFixada += c.fixacao.qtdFixadaSc
      }
      return {
        ...p,
        qtdContratadaSc: qtdContratada,
        qtdFixadaSc: qtdFixada,
      }
    })
  )

  return NextResponse.json({ data: enriched })
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getScope()
    if (!scope)
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const data = planoSchema.parse(await request.json())

    if (data.safraId) {
      const safra = await db.safra.findFirst({
        where: { id: data.safraId, ...scope.whereOwn() },
      })
      if (!safra)
        return NextResponse.json(
          { error: 'Safra não encontrada' },
          { status: 404 }
        )
    }

    const created = await db.planoVendas.create({
      data: {
        workspaceId: scope.workspaceId,
        cultura: data.cultura.toLowerCase(),
        safraId: data.safraId,
        qtdPrevistaSc: data.qtdPrevistaSc,
        precoMedioPrevistoSc: data.precoMedioPrevistoSc,
        observacoes: data.observacoes,
        status: 'ativo',
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe plano para essa cultura/safra' },
        { status: 409 }
      )
    }
    console.error('Create plano error:', error)
    return NextResponse.json({ error: 'Erro ao criar plano' }, { status: 500 })
  }
}
