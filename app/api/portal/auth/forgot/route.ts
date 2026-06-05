/**
 * POST /api/portal/auth/forgot
 * Body: { email }
 * Sempre retorna 200 (não revela existência de conta).
 * Gera token raw + hash bcrypt + envia email com link de reset.
 */
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email-service'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({ email: z.string().email() })

const TTL_HOURS = 1
const BCRYPT_ROUNDS = 12

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: true })
  }
  const email = parsed.data.email.toLowerCase()
  const access = await db.produtorAccess.findFirst({
    where: { emailLogin: email },
    orderBy: { ultimoLogin: 'desc' },
    include: {
      workspace: { select: { slug: true, name: true } },
      cliente: { select: { nome: true } },
    },
  })

  // Resposta sempre OK (não vazar enumeração de emails).
  if (!access || !access.ativo) {
    return NextResponse.json({ ok: true })
  }

  const tokenRaw = crypto.randomBytes(24).toString('hex')
  const tokenHash = await bcrypt.hash(tokenRaw, BCRYPT_ROUNDS)
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null
  const ua = req.headers.get('user-agent')?.slice(0, 255) ?? null

  await db.produtorPasswordReset.create({
    data: {
      produtorAccessId: access.id,
      tokenHash,
      expiresAt: new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000),
      requestedIp: ip ?? undefined,
      requestedUa: ua ?? undefined,
    },
  })

  const base = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ''
  const link = `${base}/portal/${access.workspace.slug}/reset?token=${tokenRaw}&email=${encodeURIComponent(email)}`
  const brand = access.workspace.name || 'Portal do Produtor'

  await sendEmail({
    to: email,
    subject: `Redefinir senha · ${brand}`,
    html: `<!doctype html>
<html><body style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#222">
  <h2 style="color:#0a8a3a">Redefinir senha</h2>
  <p>Olá ${access.cliente.nome || ''},</p>
  <p>Recebemos um pedido para redefinir a senha do seu acesso ao portal <strong>${brand}</strong>.</p>
  <p style="text-align:center;margin:24px 0">
    <a href="${link}" style="background:#0a8a3a;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">Definir nova senha</a>
  </p>
  <p style="font-size:13px;color:#666">O link expira em ${TTL_HOURS}h. Caso não tenha solicitado, ignore este email.</p>
  <p style="font-size:11px;color:#aaa;text-align:center;margin-top:24px">powered by <strong>BH Grain</strong></p>
</body></html>`,
    text: `Para redefinir sua senha acesse: ${link}\nExpira em ${TTL_HOURS}h.\n\npowered by BH Grain`,
  }).catch((err) => console.error('[forgot] email falhou:', err))

  await logAudit({
    userId: 'portal-produtor',
    workspaceId: access.workspaceId,
    acao: 'password_reset_request',
    entidade: 'ProdutorAccess',
    entidadeId: access.id,
    mudancas: { ip, ua },
  }).catch(() => undefined)

  return NextResponse.json({ ok: true })
}
