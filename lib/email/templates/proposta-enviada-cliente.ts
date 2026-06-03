/**
 * Template: cliente recebe uma proposta nova.
 *
 * Inclui CTA pro portal (onde ele aceita) e fallback opcional pro PDF público.
 */
import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface PropostaEnviadaClienteArgs {
  clienteNome: string
  propostaNumero: string
  valorFormatado: string
  validadeFormatada: string
  /** Resumo curto: "1000sc soja a R$130/sc" */
  resumoItens?: string
  /** URL do portal /portal/[slug]/propostas/[id] (preferido). */
  portalUrl: string
  /** Workspace que envia (corretora). */
  workspaceNome: string
  /** Link público do PDF (fallback se cliente não quiser logar). */
  pdfPublicoUrl?: string | null
}

export function propostaEnviadaClienteTemplate(args: PropostaEnviadaClienteArgs) {
  const cliente = escapeHtml(args.clienteNome)
  const numero = escapeHtml(args.propostaNumero)
  const valor = escapeHtml(args.valorFormatado)
  const validade = escapeHtml(args.validadeFormatada)
  const workspace = escapeHtml(args.workspaceNome)
  const resumo = args.resumoItens ? escapeHtml(args.resumoItens) : null

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Olá ${cliente},</p>
    <p style="margin:0 0 14px 0;">
      A <strong>${workspace}</strong> enviou uma nova proposta comercial para você:
      <strong style="font-family:'SF Mono',Monaco,monospace;">${numero}</strong>.
    </p>
    <div style="padding:14px 16px;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.bg};margin:0 0 14px 0;">
      ${resumo ? `<p style="margin:0 0 6px 0;font-size:14px;"><strong>Itens:</strong> ${resumo}</p>` : ''}
      <p style="margin:0 0 6px 0;font-size:14px;"><strong>Valor:</strong> ${valor}</p>
      <p style="margin:0;font-size:14px;color:${COLORS.textMuted};">Válida até <strong>${validade}</strong></p>
    </div>
    <p style="margin:0 0 14px 0;">
      Para revisar, aceitar ou recusar formalmente, acesse o portal:
    </p>
    ${
      args.pdfPublicoUrl
        ? `<p style="margin:8px 0 0 0;font-size:13px;color:${COLORS.textMuted};">
            Ou veja o PDF direto sem login:
            <a href="${args.pdfPublicoUrl}" style="color:${COLORS.accent};">abrir PDF</a>.
          </p>`
        : ''
    }
  `

  const html = renderEmailLayout({
    title: `Nova proposta ${args.propostaNumero}`,
    preheader: `${args.workspaceNome} enviou a proposta ${args.propostaNumero} (${args.valorFormatado})`,
    bodyHtml,
    ctaLabel: 'Acessar portal e decidir',
    ctaUrl: args.portalUrl,
  })

  return {
    subject: `Nova proposta ${args.propostaNumero} — ${args.workspaceNome}`,
    html,
    text: plainText(html),
  }
}
