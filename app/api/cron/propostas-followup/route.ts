/**
 * Cron — follow-up automático de propostas enviadas sem resposta.
 *
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`
 * Schedule sugerido: diário às 11:00 UTC (08:00 BRT).
 *
 * Regra:
 *   - Status 'enviada' OU 'em_negociacao'
 *   - enviadaEm está entre [now-7d, now-3d] (entre 3 e 7 dias atrás)
 *   - vistaEm IS NULL OU (vistaEm < now-2d)  → cliente sumiu
 *   - validadeEm > now (não vencida)
 *   - Não rodou follow-up ainda (rastreado em audit log 'proposta_followup_disparado')
 *
 * Ação:
 *   - WhatsApp pro cliente (se tem) com lembrete amigável
 *   - Email pro cliente (se tem) com link pro portal
 *   - Audit log 'proposta_followup_disparado' pra não duplicar
 *
 * Best-effort: cada falha é isolada, processa o próximo.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { captureError, captureMessage } from '@/lib/observability/capture'
import { notificarPorWhats } from '@/lib/whatsapp/notificar'
import { sendEmailRastreado } from '@/lib/email/send-rastreado'
import { gerarTokenProposta } from '@/lib/propostas/share-token'
import { somaValorTotal } from '@/lib/propostas/grao-item'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function handle(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    captureMessage('cron propostas-followup: CRON_SECRET ausente', 'error')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const seteDiasAtras = new Date(now.getTime() - 7 * 86_400_000)
  const tresDiasAtras = new Date(now.getTime() - 3 * 86_400_000)
  const doisDiasAtras = new Date(now.getTime() - 2 * 86_400_000)

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.profitsync.ia.br'

  let candidatos = 0
  let disparados = 0
  let pulados = 0
  let erros = 0

  try {
    const candidatosArr = await db.proposta.findMany({
      where: {
        status: { in: ['enviada', 'em_negociacao'] },
        enviadaEm: { gte: seteDiasAtras, lte: tresDiasAtras },
        validadeEm: { gt: now },
        OR: [{ vistaEm: null }, { vistaEm: { lt: doisDiasAtras } }],
      },
      select: {
        id: true,
        numero: true,
        valorTotal: true,
        validadeEm: true,
        graos: true,
        clienteId: true,
        workspaceId: true,
        cliente: { select: { nome: true, email: true, whatsapp: true } },
        workspace: { select: { name: true, slug: true } },
      },
      take: 500,
    })
    candidatos = candidatosArr.length

    for (const p of candidatosArr) {
      if (!p.cliente || !p.workspace?.slug) {
        pulados++
        continue
      }
      try {
        // Idempotência: checa se já houve follow-up nos últimos 3 dias
        const jaDisparou = await db.auditLog.findFirst({
          where: {
            workspaceId: p.workspaceId,
            entidade: 'proposta',
            entidadeId: p.id,
            acao: 'proposta_followup_disparado',
            criadoEm: { gte: tresDiasAtras },
          },
          select: { id: true },
        })
        if (jaDisparou) {
          pulados++
          continue
        }

        const valor = Number(p.valorTotal).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })
        const validade = p.validadeEm.toLocaleDateString('pt-BR')
        const portalUrl = `${origin}/portal/${p.workspace.slug}/propostas/${p.id}`

        // WhatsApp se tem
        if (p.cliente.whatsapp) {
          const texto =
            `📋 Olá ${p.cliente.nome}!\n\n` +
            `Tudo bem? Queremos saber se você teve oportunidade de revisar a proposta *${p.numero}* ` +
            `(${valor}) que enviamos.\n\n` +
            `Ela é válida até *${validade}*. Acesse pelo link para aceitar, recusar ou tirar dúvidas:\n\n` +
            portalUrl +
            `\n\n_Se preferir, responda esta mensagem._\n` +
            `_Enviado automaticamente pelo sistema_`
          await notificarPorWhats({
            workspaceId: p.workspaceId,
            para: p.cliente.whatsapp,
            texto,
            categoria: 'proposta_enviada_cliente', // categoria existente
            meta: {
              propostaId: p.id,
              propostaNumero: p.numero,
              tipo: 'followup',
            },
          })
        }

        // Email se tem
        if (p.cliente.email) {
          let pdfPublicoUrl: string | null = null
          try {
            const { token } = gerarTokenProposta(p.id, { expiraEm: p.validadeEm })
            pdfPublicoUrl = `${origin}/api/propostas/share/${token}`
          } catch {
            /* ignore */
          }

          const subject = `Lembrete: proposta ${p.numero} ainda aguarda sua decisão`
          const html = `
            <p>Olá ${p.cliente.nome},</p>
            <p>Notamos que ainda não tivemos sua resposta sobre a proposta <strong>${p.numero}</strong>
            (${valor}) que enviamos.</p>
            <p>Ela é válida até <strong>${validade}</strong>.</p>
            <p><a href="${portalUrl}" style="display:inline-block;padding:10px 18px;background:#0a8a3a;color:#fff;text-decoration:none;border-radius:6px;">Acessar portal</a></p>
            ${pdfPublicoUrl ? `<p style="font-size:12px;color:#666;">Ou veja o PDF direto: <a href="${pdfPublicoUrl}">abrir</a></p>` : ''}
            <p style="font-size:12px;color:#999;">Enviado automaticamente como lembrete.</p>
          `
          await sendEmailRastreado({
            workspaceId: p.workspaceId,
            categoria: 'proposta_followup_cliente_email',
            destinatarioNome: p.cliente.nome,
            to: p.cliente.email,
            subject,
            html,
            meta: { propostaId: p.id, propostaNumero: p.numero, tipo: 'followup' },
          })
        }

        // Marca como disparado (idempotência)
        await db.auditLog.create({
          data: {
            userId: 'system_cron',
            workspaceId: p.workspaceId,
            acao: 'proposta_followup_disparado',
            entidade: 'proposta',
            entidadeId: p.id,
            mudancas: {
              numero: p.numero,
              enviouWhats: !!p.cliente.whatsapp,
              enviouEmail: !!p.cliente.email,
              em: now.toISOString(),
            },
          },
        })

        disparados++
      } catch (err) {
        erros++
        captureError(err as Error, {
          where: 'cron/propostas-followup',
          propostaId: p.id,
        })
      }
    }
  } catch (err) {
    captureError(err as Error, { where: 'cron/propostas-followup' })
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }

  // satisfy lint — somaValorTotal não usado ainda (deixei import para evolução)
  void somaValorTotal

  return NextResponse.json({
    ok: true,
    candidatos,
    disparados,
    pulados,
    erros,
    processadoEm: now.toISOString(),
  })
}

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}
