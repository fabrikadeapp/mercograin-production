import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface ContractAcceptanceArgs {
  contractNumber: string
  signerName: string
  acceptUrl: string
  expiresInDays?: number
}

export function contractAcceptanceTemplate(args: ContractAcceptanceArgs) {
  const num = escapeHtml(args.contractNumber)
  const signer = escapeHtml(args.signerName)
  const days = args.expiresInDays ?? 7

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Olá ${signer},</p>
    <p style="margin:0 0 14px 0;">O contrato <strong style="font-family:'SF Mono',Monaco,monospace;">${num}</strong> está pronto para sua revisão e aceite digital.</p>
    <div style="padding:14px 16px;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.bg};margin:0 0 14px 0;">
      <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">O link abaixo é único e expira em ${days} dias.</p>
    </div>
    <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">Se você não reconhece este contrato, ignore este e-mail ou entre em contato com a corretora.</p>
  `

  const html = renderEmailLayout({
    title: `Contrato ${args.contractNumber} aguarda seu aceite`,
    preheader: `Revise e aceite o contrato ${args.contractNumber} digitalmente.`,
    bodyHtml,
    ctaLabel: 'Revisar e aceitar contrato',
    ctaUrl: args.acceptUrl,
  })

  return {
    subject: `Contrato ${args.contractNumber} aguarda seu aceite`,
    html,
    text: plainText(html),
  }
}
