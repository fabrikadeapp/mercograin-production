import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'

const contatoSchema = z.object({
  nome: z.string().min(2, 'Nome muito curto').max(120),
  email: z.string().email('Email inválido').max(180),
  empresa: z.string().max(180).optional().nullable(),
  mensagem: z.string().min(10, 'Mensagem muito curta').max(4000),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 contatos/hora por IP — protege contra spam no formulário público.
    const ip = getClientIp(req)
    const limit = rateLimit(`contato:${ip}`, 5, 60 * 60 * 1000)
    if (!limit.ok) {
      const minutes = Math.ceil(limit.resetIn / 60000)
      return NextResponse.json(
        {
          ok: false,
          error: `Muitas tentativas. Tente novamente em ${minutes} min.`,
        },
        { status: 429 },
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { ok: false, error: 'JSON inválido' },
        { status: 400 },
      )
    }

    const parsed = contatoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Dados inválidos',
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 422 },
      )
    }

    const data = parsed.data

    await db.webhookLog.create({
      data: {
        tipo: 'contato',
        status: 'recebido',
        payload: data,
        mensagem: `Contato de ${data.nome} (${data.email})`,
        ipOrigem: ip !== 'unknown' ? ip : undefined,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error in /api/contato:', error)
    return NextResponse.json(
      { ok: false, error: 'Erro ao processar contato' },
      { status: 500 },
    )
  }
}
