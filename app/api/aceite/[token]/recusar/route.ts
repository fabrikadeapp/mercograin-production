/**
 * Recusar contrato — endpoint PÚBLICO. Registra motivo + IP/UA.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { validarTokenAceite, hashToken } from '@/lib/contratos/aceite'

const schema = z.object({
  aceitanteNome: z.string().min(1).max(255).optional(),
  motivo: z.string().min(1).max(2000),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params
  const { contratoId, valid } = validarTokenAceite(token)
  if (!valid) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Motivo é obrigatório' }, { status: 400 })
  }

  const tokenHash = hashToken(token)
  const aceite = await db.aceiteContrato.findUnique({ where: { tokenHash } })
  if (!aceite || aceite.contratoId !== contratoId) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  }
  if (aceite.status !== 'pendente') {
    return NextResponse.json(
      { error: `Aceite já está ${aceite.status}` },
      { status: 409 }
    )
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    null
  const ua = req.headers.get('user-agent') || null

  await db.aceiteContrato.update({
    where: { id: aceite.id },
    data: {
      status: 'recusado',
      aceitoEm: new Date(),
      aceitanteNome: parsed.data.aceitanteNome ?? null,
      ipAceite: ip,
      userAgentAceite: ua,
      observacoesRecusa: parsed.data.motivo,
    },
  })

  return NextResponse.json({ success: true })
}
