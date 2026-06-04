/**
 * Notificações para o fluxo de assinatura nativa.
 *
 * - notifySignatario(): envia link ao signatário (email + WhatsApp se disponível).
 * - notifyStaffConcluido(): avisa equipe quando todos assinarem.
 *
 * Sempre degrada graciosamente — falhas de envio não bloqueiam o fluxo,
 * apenas são logadas e retornadas no resultado.
 *
 * Vide docs/specs/assinaturapropriaonline.md §8.
 */

import { sendEmail } from '@/lib/email-service'
import { sendWhatsAppMessage } from '@/lib/whatsapp-service'

interface SignatarioInput {
  nome?: string
  email?: string
  telefone?: string
  url: string
}

interface NotifySignatarioParams {
  contratoNumero: string
  brandNome?: string
  signatario: SignatarioInput
}

export interface NotifyResultado {
  emailEnviado: boolean
  whatsappEnviado: boolean
  erros: string[]
}

function maskUrl(url: string): string {
  // Não logar URL completa (contém token sensível).
  try {
    const u = new URL(url)
    return `${u.origin}/assinar/***`
  } catch {
    return '/assinar/***'
  }
}

export async function notifySignatario(
  p: NotifySignatarioParams,
): Promise<NotifyResultado> {
  const r: NotifyResultado = {
    emailEnviado: false,
    whatsappEnviado: false,
    erros: [],
  }

  const nome = p.signatario.nome?.trim() || 'Sr(a).'
  const brand = p.brandNome?.trim() || 'BH Grain'

  // ---------- EMAIL ----------
  if (p.signatario.email) {
    try {
      const subject = `Contrato ${p.contratoNumero} aguardando sua assinatura · ${brand}`
      const html = renderEmailHtml({
        nome,
        contratoNumero: p.contratoNumero,
        url: p.signatario.url,
        brand,
      })
      const text =
        `Olá ${nome},\n\n` +
        `O contrato ${p.contratoNumero} está aguardando sua assinatura.\n` +
        `Acesse: ${p.signatario.url}\n\n` +
        `Este link tem validade legal conforme Lei 14.063/2020.\n` +
        `Caso não reconheça, ignore esta mensagem.\n\n— ${brand}`
      const res = await sendEmail({
        to: p.signatario.email,
        subject,
        html,
        text,
      })
      r.emailEnviado = res.ok
      if (!res.ok && !res.skipped) {
        r.erros.push(`email: ${res.error ?? 'falha'}`)
      }
    } catch (err) {
      r.erros.push(`email: ${err instanceof Error ? err.message : 'erro'}`)
      console.error(
        `[signature/notify] email falhou para ${p.signatario.email} → ${maskUrl(p.signatario.url)}`,
        err,
      )
    }
  }

  // ---------- WHATSAPP ----------
  if (p.signatario.telefone) {
    try {
      const msg =
        `📄 *${brand}*\n\n` +
        `Olá ${nome}, o contrato *${p.contratoNumero}* está aguardando sua assinatura.\n\n` +
        `Acesse o link para revisar e assinar:\n${p.signatario.url}\n\n` +
        `_Validade legal: Lei 14.063/2020 · Assinatura eletrônica simples_`
      const res = await sendWhatsAppMessage(p.signatario.telefone, msg)
      r.whatsappEnviado = res.success
      if (!res.success) {
        r.erros.push(`whatsapp: ${res.error ?? 'falha'}`)
      }
    } catch (err) {
      r.erros.push(`whatsapp: ${err instanceof Error ? err.message : 'erro'}`)
      console.error(
        `[signature/notify] whatsapp falhou para ${p.signatario.telefone}`,
        err,
      )
    }
  }

  return r
}

interface NotifyStaffParams {
  emails: string[]
  telefones?: string[]
  contratoNumero: string
  clienteNome: string
  brandNome?: string
  totalSignatarios: number
  linkInternoContrato?: string
}

export async function notifyStaffConcluido(
  p: NotifyStaffParams,
): Promise<NotifyResultado> {
  const r: NotifyResultado = {
    emailEnviado: false,
    whatsappEnviado: false,
    erros: [],
  }
  const brand = p.brandNome?.trim() || 'BH Grain'

  for (const email of p.emails.filter(Boolean)) {
    try {
      const res = await sendEmail({
        to: email,
        subject: `✅ Contrato ${p.contratoNumero} foi assinado por todos · ${brand}`,
        html:
          `<p>O contrato <strong>${p.contratoNumero}</strong> ` +
          `(cliente: ${p.clienteNome}) foi assinado por todos os ` +
          `${p.totalSignatarios} signatários.</p>` +
          (p.linkInternoContrato
            ? `<p><a href="${p.linkInternoContrato}">Abrir contrato no sistema</a></p>`
            : '') +
          `<p>O PDF assinado e a página de evidências estão disponíveis no contrato.</p>`,
        text:
          `Contrato ${p.contratoNumero} (${p.clienteNome}) foi assinado ` +
          `por todos os ${p.totalSignatarios} signatários.` +
          (p.linkInternoContrato ? `\nAbrir: ${p.linkInternoContrato}` : ''),
      })
      if (res.ok) r.emailEnviado = true
      else if (!res.skipped) r.erros.push(`email[${email}]: ${res.error ?? 'falha'}`)
    } catch (err) {
      r.erros.push(`email[${email}]: ${err instanceof Error ? err.message : 'erro'}`)
    }
  }

  for (const tel of (p.telefones ?? []).filter(Boolean)) {
    try {
      const msg =
        `✅ *${brand}*\n\n` +
        `Contrato *${p.contratoNumero}* (${p.clienteNome}) foi assinado por ` +
        `todos os ${p.totalSignatarios} signatários.`
      const res = await sendWhatsAppMessage(tel, msg)
      if (res.success) r.whatsappEnviado = true
      else r.erros.push(`whatsapp[${tel}]: ${res.error ?? 'falha'}`)
    } catch (err) {
      r.erros.push(`whatsapp[${tel}]: ${err instanceof Error ? err.message : 'erro'}`)
    }
  }

  return r
}

function renderEmailHtml(p: {
  nome: string
  contratoNumero: string
  url: string
  brand: string
}): string {
  return `<!doctype html>
<html><body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222">
  <div style="text-align:center;margin-bottom:24px">
    <h2 style="color:#0a8a3a;margin:0">${escapeHtml(p.brand)}</h2>
  </div>
  <h3 style="margin:0 0 12px 0">Olá ${escapeHtml(p.nome)},</h3>
  <p style="line-height:1.6">
    O contrato <strong>${escapeHtml(p.contratoNumero)}</strong>
    está aguardando sua assinatura.
  </p>
  <div style="text-align:center;margin:32px 0">
    <a href="${escapeAttr(p.url)}"
       style="background:#0a8a3a;color:#fff;text-decoration:none;
              padding:14px 32px;border-radius:6px;display:inline-block;
              font-weight:600">
      Revisar e assinar
    </a>
  </div>
  <p style="font-size:13px;color:#666;line-height:1.5">
    Você pode revisar o documento completo antes de assinar.
    A assinatura tem validade legal conforme
    <strong>Lei nº 14.063/2020</strong> (assinatura eletrônica simples).
  </p>
  <p style="font-size:12px;color:#999;line-height:1.5">
    Caso não reconheça este envio, ignore esta mensagem.
    O link expira em 30 dias.
  </p>
  <hr style="border:0;border-top:1px solid #eee;margin:24px 0" />
  <p style="font-size:11px;color:#aaa;text-align:center">
    ${escapeHtml(p.brand)} · Trading de Grãos
  </p>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}
