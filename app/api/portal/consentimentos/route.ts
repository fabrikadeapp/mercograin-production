/**
 * PUT /api/portal/consentimentos
 * Body: { execucaoContrato: bool, comunicacaoWhatsapp: bool,
 *         compartilhamentoBancoCartorio: bool, marketing: bool }
 *
 * Registra consentimento LGPD por finalidade com IP/UA/timestamp.
 * Spec: docs/specs/assinaturapropriaonline.md §9 (LGPD).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getPortalSession } from '@/lib/portal-produtor/auth'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const schema = z.object({
  execucaoContrato: z.boolean(),
  comunicacaoWhatsapp: z.boolean(),
  compartilhamentoBancoCartorio: z.boolean(),
  marketing: z.boolean(),
})

const OBRIGATORIOS = ['execucaoContrato', 'compartilhamentoBancoCartorio'] as const

export interface ConsentimentoRegistro {
  finalidade: string
  granted: boolean
  ip: string | null
  ua: string | null
  timestamp: string
}

export async function GET() {
  const session = await getPortalSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const a = await db.produtorAccess.findUnique({
    where: { id: session.accessId },
    select: { consentimentos: true },
  })
  return NextResponse.json({ ok: true, consentimentos: a?.consentimentos ?? [] })
}

export async function PUT(req: NextRequest) {
  const session = await getPortalSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid' },
      { status: 400 },
    )
  }
  const data = parsed.data
  for (const k of OBRIGATORIOS) {
    if (!data[k]) {
      return NextResponse.json(
        { error: 'consentimento_obrigatorio_negado', finalidade: k },
        { status: 400 },
      )
    }
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null
  const ua = req.headers.get('user-agent')?.slice(0, 255) ?? null
  const timestamp = new Date().toISOString()

  const registros: ConsentimentoRegistro[] = (
    Object.entries(data) as Array<[keyof typeof data, boolean]>
  ).map(([finalidade, granted]) => ({
    finalidade,
    granted,
    ip,
    ua,
    timestamp,
  }))

  const atual = await db.produtorAccess.findUnique({
    where: { id: session.accessId },
    select: { consentimentos: true },
  })
  const previos: ConsentimentoRegistro[] = Array.isArray(atual?.consentimentos)
    ? (atual!.consentimentos as unknown as ConsentimentoRegistro[])
    : []

  await db.produtorAccess.update({
    where: { id: session.accessId },
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      consentimentos: [...previos, ...registros] as any,
    },
  })

  await logAudit({
    userId: 'portal-produtor',
    workspaceId: session.workspaceId,
    acao: 'consent',
    entidade: 'ProdutorAccess.consentimentos',
    entidadeId: session.accessId,
    mudancas: { registros },
  }).catch(() => undefined)

  return NextResponse.json({ ok: true, registros })
}
