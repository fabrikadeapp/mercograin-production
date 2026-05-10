import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface ContractSignedArgs {
  contractNumber: string
  signerName: string
  signedAt: Date | string
  contractUrl: string
}

function fmtDateTime(v: Date | string): string {
  const d = v instanceof Date ? v : new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function contractSignedTemplate(args: ContractSignedArgs) {
  const num = escapeHtml(args.contractNumber)
  const signer = escapeHtml(args.signerName)
  const ts = escapeHtml(fmtDateTime(args.signedAt))

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Boas notícias — o contrato <strong style="font-family:'SF Mono',Monaco,monospace;">${num}</strong> foi assinado.</p>
    <div style="padding:14px 16px;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.bg};margin:0 0 14px 0;">
      <p style="margin:0 0 4px 0;font-size:13px;color:${COLORS.textMuted};">Assinado por</p>
      <p style="margin:0 0 12px 0;font-size:15px;font-weight:600;color:${COLORS.text};">${signer}</p>
      <p style="margin:0 0 4px 0;font-size:13px;color:${COLORS.textMuted};">Data e hora</p>
      <p style="margin:0;font-size:14px;color:${COLORS.text};font-family:'SF Mono',Monaco,monospace;">${ts}</p>
    </div>
    <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">O documento assinado está disponível no painel para download e arquivamento.</p>
  `

  const html = renderEmailLayout({
    title: `Contrato ${args.contractNumber} foi assinado`,
    preheader: `${signer} assinou o contrato ${args.contractNumber}.`,
    bodyHtml,
    ctaLabel: 'Ver contrato assinado',
    ctaUrl: args.contractUrl,
  })

  return {
    subject: `Contrato ${args.contractNumber} foi assinado`,
    html,
    text: plainText(html),
  }
}
