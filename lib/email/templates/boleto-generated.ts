import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface BoletoGeneratedArgs {
  payerName: string
  valor: number | string
  vencimento: Date | string
  linkPdf?: string
  linkBoleto: string
  linhaDigitavel?: string
  numero?: string
}

function fmtBRL(v: number | string): string {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!isFinite(n)) return String(v)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

function fmtDate(v: Date | string): string {
  const d = v instanceof Date ? v : new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('pt-BR')
}

export function boletoGeneratedTemplate(args: BoletoGeneratedArgs) {
  const payer = escapeHtml(args.payerName)
  const valor = fmtBRL(args.valor)
  const venc = escapeHtml(fmtDate(args.vencimento))
  const link = args.linkBoleto
  const pdf = args.linkPdf
  const linha = args.linhaDigitavel ? escapeHtml(args.linhaDigitavel) : null

  const row = (k: string, v: string) => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:${COLORS.textMuted};border-bottom:1px solid ${COLORS.border};">${k}</td>
      <td style="padding:8px 12px;font-size:13px;color:${COLORS.text};font-weight:600;text-align:right;border-bottom:1px solid ${COLORS.border};">${v}</td>
    </tr>`

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Olá, ${payer}. Seu boleto está pronto.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;border:1px solid ${COLORS.border};border-radius:8px;overflow:hidden;">
      ${args.numero ? row('Número', `<span style="font-family:'SF Mono',Monaco,monospace;">${escapeHtml(args.numero)}</span>`) : ''}
      ${row('Valor', valor)}
      ${row('Vencimento', venc)}
    </table>
    ${linha ? `
      <p style="margin:0 0 6px 0;font-size:13px;color:${COLORS.textMuted};">Linha digitável:</p>
      <p style="margin:0 0 14px 0;padding:10px 12px;background-color:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:6px;font-family:'SF Mono',Monaco,monospace;font-size:12px;color:${COLORS.text};word-break:break-all;">${linha}</p>
    ` : ''}
    ${pdf ? `<p style="margin:0;font-size:13px;color:${COLORS.textMuted};">Versão PDF: <a href="${escapeHtml(pdf)}" style="color:${COLORS.accent};">baixar arquivo</a></p>` : ''}
  `

  const html = renderEmailLayout({
    title: `Boleto disponível: vencimento ${fmtDate(args.vencimento)}`,
    preheader: `Boleto de ${valor} com vencimento em ${fmtDate(args.vencimento)}.`,
    bodyHtml,
    ctaLabel: 'Baixar boleto',
    ctaUrl: link,
  })

  return {
    subject: `Boleto disponível: vencimento ${fmtDate(args.vencimento)}`,
    html,
    text: plainText(html),
  }
}
