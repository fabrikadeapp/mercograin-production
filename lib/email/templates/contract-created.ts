import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface ContractCreatedArgs {
  contractNumber: string
  contractUrl: string
  corretoraName: string
  granoLabel: string
  quantidadeSc: number | string
  precoSc: number | string
}

function fmtBRL(v: number | string): string {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!isFinite(n)) return String(v)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

export function contractCreatedTemplate(args: ContractCreatedArgs) {
  const num = escapeHtml(args.contractNumber)
  const corretora = escapeHtml(args.corretoraName)
  const grano = escapeHtml(args.granoLabel)
  const qtd = typeof args.quantidadeSc === 'number'
    ? args.quantidadeSc.toLocaleString('pt-BR')
    : escapeHtml(String(args.quantidadeSc))

  const row = (k: string, v: string) => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:${COLORS.textMuted};border-bottom:1px solid ${COLORS.border};">${k}</td>
      <td style="padding:8px 12px;font-size:13px;color:${COLORS.text};font-weight:600;text-align:right;border-bottom:1px solid ${COLORS.border};">${v}</td>
    </tr>`

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Um novo contrato foi gerado por <strong>${corretora}</strong> e está disponível para sua revisão.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;border:1px solid ${COLORS.border};border-radius:8px;overflow:hidden;">
      ${row('Número do contrato', `<span style="font-family:'SF Mono',Monaco,monospace;">${num}</span>`)}
      ${row('Grão', grano)}
      ${row('Quantidade', `${qtd} sacas`)}
      ${row('Preço por saca', fmtBRL(args.precoSc))}
    </table>
    <p style="margin:0 0 8px 0;font-size:13px;color:${COLORS.textMuted};">Por favor, revise os termos e proceda com a assinatura digital quando estiver de acordo.</p>
  `

  const html = renderEmailLayout({
    title: `Contrato ${args.contractNumber} disponível para revisão`,
    preheader: `Novo contrato de ${grano} (${qtd} sc) gerado por ${corretora}.`,
    bodyHtml,
    ctaLabel: 'Visualizar contrato',
    ctaUrl: args.contractUrl,
  })

  return {
    subject: `Contrato ${args.contractNumber} disponível para revisão`,
    html,
    text: plainText(html),
  }
}
