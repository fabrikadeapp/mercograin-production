import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface PriceAlertArgs {
  name: string
  granoLabel: string
  precoAtual: number | string
  alvoLabel: string // ex: "≥ R$ 145,00"
  fonte?: string
}

function fmtBRL(v: number | string): string {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!isFinite(n)) return String(v)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

export function priceAlertTemplate(args: PriceAlertArgs) {
  const name = escapeHtml(args.name || 'operador')
  const grano = escapeHtml(args.granoLabel)
  const alvo = escapeHtml(args.alvoLabel)
  const fonte = escapeHtml(args.fonte || 'CEPEA-ESALQ')
  const preco = fmtBRL(args.precoAtual)
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Olá, ${name}. Seu alerta de preço foi disparado.</p>
    <div style="padding:18px 16px;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.bg};margin:0 0 14px 0;text-align:center;">
      <p style="margin:0 0 6px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;color:${COLORS.textMuted};font-weight:600;">${grano}</p>
      <p style="margin:0 0 6px 0;font-size:32px;font-weight:700;color:${COLORS.accent};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${preco}</p>
      <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">Condição atingida: <strong style="color:${COLORS.text};">${alvo}</strong></p>
    </div>
    <p style="margin:0 0 14px 0;font-size:13px;color:${COLORS.textMuted};">Fonte: ${fonte}</p>
    <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">Acesse o painel para ver o histórico completo, gráficos e gerenciar seus alertas.</p>
  `

  const html = renderEmailLayout({
    title: `Alerta: ${args.granoLabel} atingiu ${args.alvoLabel}`,
    preheader: `${grano} a ${preco} — alerta ${alvo} disparado.`,
    bodyHtml,
    ctaLabel: 'Ver cotações',
    ctaUrl: `${APP_URL}/cotacoes`,
  })

  return {
    subject: `Alerta: ${args.granoLabel} atingiu ${args.alvoLabel}`,
    html,
    text: plainText(html),
  }
}
