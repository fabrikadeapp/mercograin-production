/**
 * Aceitar contrato — endpoint PÚBLICO autenticado pelo token.
 * Registra IP/UA/geo e atualiza Contrato.statusAssinatura='assinado'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { validarTokenAceite, hashToken } from '@/lib/contratos/aceite'
import { sendEmail } from '@/lib/email/send'
import { contractSignedTemplate } from '@/lib/email/templates/contract-signed'

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.profitsync.ia.br'
).replace(/\/+$/, '')

const schema = z.object({
  aceitanteNome: z.string().min(1).max(255),
  aceitanteCpfCnpj: z.string().min(1).max(20).optional(),
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
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
    body = {}
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const tokenHash = hashToken(token)
  const aceite = await db.aceiteContrato.findUnique({
    where: { tokenHash },
    include: {
      contrato: {
        select: {
          id: true,
          numero: true,
          pdfHash: true,
          cliente: { select: { email: true, nome: true } },
        },
      },
    },
  })
  if (!aceite || aceite.contratoId !== contratoId) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  }
  if (aceite.status !== 'pendente') {
    return NextResponse.json(
      { error: `Aceite já está ${aceite.status}` },
      { status: 409 }
    )
  }
  if (aceite.expiraEm < new Date()) {
    await db.aceiteContrato.update({
      where: { id: aceite.id },
      data: { status: 'expirado' },
    })
    return NextResponse.json({ error: 'Link expirado' }, { status: 410 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    null
  const ua = req.headers.get('user-agent') || null

  const now = new Date()
  await db.$transaction([
    db.aceiteContrato.update({
      where: { id: aceite.id },
      data: {
        status: 'aceito',
        aceitoEm: now,
        aceitanteNome: parsed.data.aceitanteNome,
        aceitanteCpfCnpj: parsed.data.aceitanteCpfCnpj || null,
        ipAceite: ip,
        userAgentAceite: ua,
        geoLat: parsed.data.geoLat ?? null,
        geoLng: parsed.data.geoLng ?? null,
        pdfHashAceito: aceite.contrato.pdfHash,
      },
    }),
    db.contrato.update({
      where: { id: aceite.contratoId },
      data: {
        statusAssinatura: 'assinado',
        assinadoEm: now,
      },
    }),
  ])

  // Notifica corretora por e-mail (best-effort)
  if (aceite.contrato.cliente?.email) {
    const tmpl = contractSignedTemplate({
      contractNumber: aceite.contrato.numero,
      signerName: parsed.data.aceitanteNome,
      signedAt: now,
      contractUrl: `${APP_URL}/contratos/${aceite.contratoId}`,
    })
    sendEmail({
      to: aceite.contrato.cliente.email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, aceitoEm: now })
}
