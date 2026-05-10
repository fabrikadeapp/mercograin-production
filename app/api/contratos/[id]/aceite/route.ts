/**
 * Aceite digital — endpoint da corretora.
 *
 * POST → cria/recria AceiteContrato pendente, gera link único e envia ao produtor
 *        via e-mail (e WhatsApp se cliente tem número).
 * GET  → consulta status do aceite atual.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getScope } from '@/lib/auth/scope'
import { gerarTokenAceite } from '@/lib/contratos/aceite'
import { sendEmail } from '@/lib/email/send'
import { contractAcceptanceTemplate } from '@/lib/email/templates/contract-acceptance'
import { logAudit } from '@/lib/audit/log'
import { sendText } from '@/lib/whatsapp/evolution'

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.profitsync.ia.br'
).replace(/\/+$/, '')

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope(new URL(req.url).searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const aceite = await db.aceiteContrato.findFirst({
    where: { contratoId: params.id, ...scope.whereOwn() },
    select: {
      id: true,
      status: true,
      enviadoEm: true,
      expiraEm: true,
      aceitoEm: true,
      aceitanteNome: true,
      aceitanteCpfCnpj: true,
      ipAceite: true,
      observacoesRecusa: true,
    },
  })

  return NextResponse.json({ aceite })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scope = await getScope(new URL(req.url).searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const contrato = await db.contrato.findFirst({
    where: { id: params.id, ...scope.whereOwn() },
    include: {
      cliente: {
        select: { id: true, nome: true, email: true, whatsapp: true },
      },
    },
  })
  if (!contrato) {
    return NextResponse.json(
      { error: 'Contrato não encontrado' },
      { status: 404 }
    )
  }

  // Gera token e regrava (única por contrato)
  const { token, tokenHash } = gerarTokenAceite(contrato.id)
  const expiraEm = new Date(Date.now() + 7 * 86400_000)

  await db.aceiteContrato.upsert({
    where: { contratoId: contrato.id },
    create: {
      workspaceId: scope.workspaceId,
      contratoId: contrato.id,
      tokenHash,
      status: 'pendente',
      expiraEm,
    },
    update: {
      tokenHash,
      status: 'pendente',
      expiraEm,
      enviadoEm: new Date(),
      aceitoEm: null,
      ipAceite: null,
      userAgentAceite: null,
      observacoesRecusa: null,
    },
  })

  const link = `${APP_URL}/aceite/${token}`

  // Envia por e-mail (best-effort)
  if (contrato.cliente?.email) {
    const tmpl = contractAcceptanceTemplate({
      contractNumber: contrato.numero,
      signerName: contrato.cliente.nome,
      acceptUrl: link,
      expiresInDays: 7,
    })
    sendEmail({
      to: contrato.cliente.email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    }).catch(() => {})
  }

  // Envia por WhatsApp (best-effort) — só se cliente tem whatsapp e workspace tem instância
  if (contrato.cliente?.whatsapp) {
    try {
      const inst = await db.whatsAppInstance.findFirst({
        where: { workspaceId: scope.workspaceId, status: 'open' },
        select: { instanceName: true },
      })
      if (inst?.instanceName) {
        const phone = contrato.cliente.whatsapp.replace(/\D/g, '')
        const remoteJid = `${phone}@s.whatsapp.net`
        const body = `📜 Contrato ${contrato.numero} pronto para aceite digital.\n\nRevise e assine: ${link}\n\nLink válido por 7 dias.`
        sendText(inst.instanceName, remoteJid, body).catch(() => {})
      }
    } catch {
      // best-effort
    }
  }

  await logAudit({
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    acao: 'create',
    entidade: 'aceite_contrato',
    entidadeId: contrato.id,
    mudancas: { contratoNumero: contrato.numero, expiraEm },
  }).catch(() => {})

  return NextResponse.json({ link, expiraEm })
}
