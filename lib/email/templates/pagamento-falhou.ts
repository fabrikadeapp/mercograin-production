import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface PagamentoFalhouArgs {
  /** Nome do owner (cai pro email se ausente). */
  name: string
  /** Nome amigável do workspace. */
  workspaceName?: string
  /** Nome amigável do plano (ex: "Pro"). */
  planName?: string
  /** URL para gerenciar pagamento (default /assinatura). */
  billingUrl?: string
}

export function pagamentoFalhouTemplate(args: PagamentoFalhouArgs) {
  const name = escapeHtml(args.name || 'cliente')
  const ws = escapeHtml(args.workspaceName || 'sua empresa')
  const plan = escapeHtml(args.planName || 'BH Grain')
  const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'https://www.profitsync.ia.br'
  const billingUrl = args.billingUrl || `${APP_URL}/assinatura`

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Olá, ${name}.</p>
    <p style="margin:0 0 14px 0;">Não conseguimos processar o pagamento da sua assinatura <strong>${plan}</strong> em ${ws}. Sua conta está com status <strong style="color:${COLORS.text};">pagamento atrasado</strong>.</p>
    <div style="padding:14px 16px;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.bg};margin:0 0 14px 0;">
      <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:${COLORS.text};">O que fazer agora:</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:${COLORS.textMuted};line-height:1.6;">
        <li>Verifique se o cartão cadastrado está válido e com limite.</li>
        <li>Atualize a forma de pagamento clicando no botão abaixo.</li>
        <li>Tentaremos cobrar automaticamente nos próximos dias.</li>
      </ul>
    </div>
    <p style="margin:14px 0 0 0;font-size:13px;color:${COLORS.textFaint};">Se o pagamento não for regularizado, o acesso ao painel pode ser suspenso. Seus dados continuam guardados.</p>
  `

  const html = renderEmailLayout({
    title: 'Falha no pagamento da sua assinatura',
    preheader: 'Não conseguimos cobrar sua assinatura — atualize sua forma de pagamento.',
    bodyHtml,
    ctaLabel: 'Atualizar forma de pagamento',
    ctaUrl: billingUrl,
    footerNote: 'Dúvidas sobre a cobrança? Responda este e-mail.',
  })

  return {
    subject: 'Falha no pagamento da sua assinatura BH Grain',
    html,
    text: plainText(html),
  }
}
