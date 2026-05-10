/**
 * POST /api/fiscal/simulador-uf
 * Body: { origemUF, destinoUF, cultura, valorTotal, regime, destinatarioTipo, funrural? }
 */
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import { simularTributacao, listarUFs } from '@/lib/fiscal/simulador-uf'
import { z } from 'zod'

const UFsArr = listarUFs() as [string, ...string[]]

const schema = z.object({
  origemUF: z.enum(UFsArr as any),
  destinoUF: z.enum(UFsArr as any),
  cultura: z.enum(['soja', 'milho', 'cafe', 'trigo', 'algodao', 'sorgo', 'outro']),
  valorTotal: z.number().positive(),
  regime: z.enum(['lucro_real', 'lucro_presumido', 'simples']),
  destinatarioTipo: z.enum(['PF', 'PJ']),
  funrural: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const resultado = simularTributacao(parsed.data as any)
    return NextResponse.json({ data: resultado, input: parsed.data })
  } catch (err: any) {
    return NextResponse.json({ error: 'Falha simular', detalhe: err?.message }, { status: 422 })
  }
}

export async function GET() {
  return NextResponse.json({ ufs: listarUFs() })
}
