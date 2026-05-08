import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const STATUS_ENUM = z.enum(['agendada', 'em_transito', 'entregue', 'cancelada'])

const patchSchema = z.object({
  status: STATUS_ENUM,
  /** Set automático de timestamps quando aplicável */
  dataCarregamento: z.coerce.date().optional().nullable(),
  dataDescarga: z.coerce.date().optional().nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const scope = await getScope()
    if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const existing = await db.ordemCarga.findFirst({
      where: { id: params.id, ...scope.whereOwn() },
    })
    if (!existing) return NextResponse.json({ error: 'Ordem não encontrada' }, { status: 404 })

    const body = await req.json()
    const data = patchSchema.parse(body)

    const patch: Record<string, any> = { status: data.status }

    // Auto-preenche datas conforme transição, se ainda não setadas
    const now = new Date()
    if (data.status === 'em_transito' && !existing.dataCarregamento) {
      patch.dataCarregamento = data.dataCarregamento ?? now
    }
    if (data.status === 'entregue' && !existing.dataDescarga) {
      patch.dataDescarga = data.dataDescarga ?? now
    }
    if (data.dataCarregamento !== undefined) patch.dataCarregamento = data.dataCarregamento
    if (data.dataDescarga !== undefined) patch.dataDescarga = data.dataDescarga

    const updated = await db.ordemCarga.update({
      where: { id: params.id },
      data: patch,
    })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Patch status ordem error:', error)
    return NextResponse.json({ error: 'Erro ao atualizar status' }, { status: 500 })
  }
}
