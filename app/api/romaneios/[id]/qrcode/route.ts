/**
 * Gera/recupera QR Code público de um romaneio.
 *
 * GET  /api/romaneios/[id]/qrcode             → retorna PNG
 * GET  /api/romaneios/[id]/qrcode?format=json → retorna { token, url, expiraEm }
 * POST /api/romaneios/[id]/qrcode             → roda gerarTokenRomaneio e persiste hash
 *
 * Multi-tenant: valida que o romaneio pertence ao workspace do scope.
 */
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { gerarTokenRomaneio } from '@/lib/romaneios/token'

function baseUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  ).replace(/\/$/, '')
}

async function ensureToken(romaneioId: string) {
  const { token, tokenHash, expiraEm } = gerarTokenRomaneio(romaneioId, 7)
  await db.romaneio.update({
    where: { id: romaneioId },
    data: { qrTokenHash: tokenHash, qrTokenExpiraEm: expiraEm },
  })
  return { token, expiraEm }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope()
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const romaneio = await db.romaneio.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!romaneio) return NextResponse.json({ error: 'Romaneio não encontrado' }, { status: 404 })
  const { token, expiraEm } = await ensureToken(romaneio.id)
  const url = `${baseUrl(request)}/romaneios-publico/${token}`
  return NextResponse.json({ token, url, expiraEm })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url)
  const scope = await getScope(searchParams)
  if (!scope) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const romaneio = await db.romaneio.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
  })
  if (!romaneio) return NextResponse.json({ error: 'Romaneio não encontrado' }, { status: 404 })

  // Gera sempre novo token (URL imediata pra impressão). Hash anterior é
  // substituído — apenas o último QR emitido é válido.
  const { token, expiraEm } = await ensureToken(romaneio.id)
  const url = `${baseUrl(request)}/romaneios-publico/${token}`

  if (searchParams.get('format') === 'json') {
    return NextResponse.json({ token, url, expiraEm })
  }

  const png = await QRCode.toBuffer(url, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 360,
  })
  // Buffer → Uint8Array compatível com BodyInit do NextResponse
  const body = new Uint8Array(png)
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
    },
  })
}
