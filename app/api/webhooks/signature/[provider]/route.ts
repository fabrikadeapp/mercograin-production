/**
 * POST /api/webhooks/signature/[provider]
 *
 * Webhook PÚBLICO recebido pelo provider de assinatura quando o status muda.
 * Idempotente. Validação de assinatura HMAC (se workspace tiver secret).
 *
 * Comportamento:
 *  - Identifica AssinaturaDigital por providerDocId no payload (cada provider
 *    tem chave própria — extraímos heuristicamente).
 *  - Se workspace.assinaturaDigital.webhookSecret estiver setado, valida HMAC.
 *    Sem secret no DB → aceita o webhook (200 OK) p/ não criar loop de retry.
 *  - Atualiza AssinaturaDigital.status + sincroniza Contrato.statusAssinatura.
 *  - Quando 'assinado': baixa PDF, salva no Supabase Storage, calcula hash,
 *    dispara aceite digital se houver, audit log.
 */
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSignatureProvider } from '@/lib/contratos/signature'
import { verifyWebhookSignature } from '@/lib/contratos/signature'
import { getSupabaseAdmin, SUPABASE_BUCKET } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit/log'
import { sendEmail } from '@/lib/email/send'
import { contractSignedTemplate } from '@/lib/email/templates/contract-signed'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  'https://www.profitsync.ia.br'

function extractDocId(provider: string, payload: any): string | null {
  // Cada provider tem schema próprio
  switch (provider) {
    case 'zapsign':
      return payload?.token || payload?.open_id || payload?.doc?.token || null
    case 'mock':
      return payload?.providerDocId || payload?.token || null
    case 'clicksign':
      return payload?.document?.key || payload?.envelope?.key || null
    case 'd4sign':
      return payload?.uuid || payload?.documentId || null
    default:
      return payload?.providerDocId || payload?.token || null
  }
}

function extractStatus(provider: string, payload: any): string | null {
  switch (provider) {
    case 'zapsign':
      return payload?.status || payload?.event_type || null
    case 'mock':
      return payload?.status || null
    default:
      return payload?.status || payload?.event || null
  }
}

function mapStatus(raw: string | null):
  | 'pendente'
  | 'parcial'
  | 'assinado'
  | 'recusado'
  | 'expirado'
  | 'cancelado'
  | null {
  if (!raw) return null
  const s = raw.toLowerCase()
  if (s.includes('signed') || s === 'assinado' || s === 'completed') return 'assinado'
  if (s.includes('partial')) return 'parcial'
  if (s.includes('refus') || s.includes('reject')) return 'recusado'
  if (s.includes('expir')) return 'expirado'
  if (s.includes('cancel')) return 'cancelado'
  if (s.includes('pend')) return 'pendente'
  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = params.provider

  let rawBody = ''
  let payload: any = {}
  try {
    rawBody = await req.text()
    payload = rawBody ? JSON.parse(rawBody) : {}
  } catch (e) {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const docId = extractDocId(provider, payload)
  if (!docId) {
    // Sem doc id: aceita 200 p/ não retry, mas loga.
    console.warn(`[webhook signature/${provider}] sem providerDocId`, payload)
    return NextResponse.json({ ok: true, ignored: 'no_doc_id' })
  }

  const ass = await db.assinaturaDigital.findUnique({
    where: { providerDocId: docId },
    include: {
      contrato: { include: { cliente: true, workspace: { select: { owner: { select: { email: true } } } } } },
    },
  })

  if (!ass) {
    // 200 OK p/ não criar loop infinito de retries do provider.
    console.warn(`[webhook signature/${provider}] AssinaturaDigital não encontrada — docId=${docId}`)
    return NextResponse.json({ ok: true, ignored: 'unknown_doc' })
  }

  // Validação HMAC opcional
  const sigHeader =
    req.headers.get('x-zapsign-signature') ||
    req.headers.get('x-signature') ||
    req.headers.get('x-hub-signature-256') ||
    null
  if (ass.webhookSecret) {
    if (!verifyWebhookSignature(rawBody, sigHeader, ass.webhookSecret)) {
      // Secret existe e bate? Não. Rejeita 401.
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }
  }
  // Se ass.webhookSecret é null, aceita silenciosamente (regra do task).

  const newStatus = mapStatus(extractStatus(provider, payload))
  if (!newStatus) {
    return NextResponse.json({ ok: true, ignored: 'unknown_status' })
  }

  // Idempotência: se já está no mesmo status, no-op.
  if (ass.status === newStatus) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  // Caso 'assinado' — baixa PDF, salva no Supabase, dispara emails
  if (newStatus === 'assinado') {
    let signedUrl: string | null = null
    let signedHash: string | null = null
    try {
      const prov = await getSignatureProvider(ass.workspaceId)
      const buf = await prov.downloadSignedPdf(ass.providerDocId)
      signedHash = crypto.createHash('sha256').update(buf).digest('hex')

      try {
        const sb = getSupabaseAdmin()
        const path = `contratos-assinados/${ass.workspaceId}/${ass.contratoId}-${signedHash.slice(0, 12)}.pdf`
        const { error } = await sb.storage
          .from(SUPABASE_BUCKET)
          .upload(path, buf, {
            contentType: 'application/pdf',
            upsert: true,
          })
        if (!error) {
          const { data: pub } = sb.storage.from(SUPABASE_BUCKET).getPublicUrl(path)
          signedUrl = pub?.publicUrl ?? null
        } else {
          console.error('[webhook signature] supabase upload error:', error)
        }
      } catch (e) {
        console.error('[webhook signature] storage fallback:', e)
      }
    } catch (e) {
      console.error('[webhook signature] download signed pdf failed:', e)
    }

    await db.$transaction(async (tx) => {
      // Recupera signatários atualizados do provider, se possível
      let updatedSignatarios = ass.signatarios as any
      try {
        const prov2 = await getSignatureProvider(ass.workspaceId)
        const st = await prov2.status(ass.providerDocId)
        if (Array.isArray(updatedSignatarios) && st.signatories.length > 0) {
          updatedSignatarios = (ass.signatarios as any[]).map((s) => {
            const found = st.signatories.find(
              (ss) => ss.cpfCnpj === s.cpfCnpj || ss.name === s.name
            )
            return {
              ...s,
              signedAt: found?.signedAt ?? s.signedAt,
              ip: found?.ip ?? s.ip,
            }
          })
        }
      } catch {
        // best-effort
      }

      await tx.assinaturaDigital.update({
        where: { id: ass.id },
        data: {
          status: 'assinado',
          finalizadoEm: new Date(),
          pdfAssinadoUrl: signedUrl,
          pdfAssinadoHash: signedHash,
          signatarios: updatedSignatarios,
        },
      })
      await tx.contrato.update({
        where: { id: ass.contratoId },
        data: {
          statusAssinatura: 'assinado',
          assinadoEm: new Date(),
        },
      })
    })

    await logAudit({
      userId: 'system:webhook',
      workspaceId: ass.workspaceId,
      acao: 'update',
      entidade: 'assinatura_digital',
      entidadeId: ass.contratoId,
      mudancas: { status: 'assinado', provider, signedHash },
    })

    // Email de notificação
    try {
      const ownerEmail = ass.contrato?.workspace?.owner?.email
      const clientEmail = ass.contrato?.cliente?.email
      const recipients = [ownerEmail, clientEmail].filter(
        (e): e is string => Boolean(e)
      )
      if (recipients.length > 0 && ass.contrato) {
        const tpl = contractSignedTemplate({
          contractNumber: ass.contrato.numero,
          signerName:
            (ass.signatarios as any[])?.[0]?.name || 'Signatário',
          signedAt: new Date(),
          contractUrl: `${APP_URL}/contratos/${ass.contratoId}`,
        })
        await sendEmail({
          to: recipients,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          tags: [{ name: 'kind', value: 'contract-signed' }],
        })
      }
    } catch (e) {
      console.error('[webhook signature] email notify failed:', e)
    }
  } else {
    // Outros status: apenas atualiza
    await db.assinaturaDigital.update({
      where: { id: ass.id },
      data: {
        status: newStatus,
        finalizadoEm:
          newStatus === 'recusado' || newStatus === 'expirado' || newStatus === 'cancelado'
            ? new Date()
            : null,
      },
    })

    if (newStatus === 'recusado' || newStatus === 'expirado') {
      await db.contrato.update({
        where: { id: ass.contratoId },
        data: { statusAssinatura: 'pendente' },
      })
    }

    await logAudit({
      userId: 'system:webhook',
      workspaceId: ass.workspaceId,
      acao: 'update',
      entidade: 'assinatura_digital',
      entidadeId: ass.contratoId,
      mudancas: { status: newStatus, provider },
    })
  }

  return NextResponse.json({ ok: true, status: newStatus })
}

export async function GET() {
  return NextResponse.json({ ok: true, info: 'signature webhook endpoint' })
}
