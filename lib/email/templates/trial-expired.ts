import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface TrialExpiredArgs {
  name: string
  billingUrl?: string
}

export function trialExpiredTemplate(args: TrialExpiredArgs) {
  const name = escapeHtml(args.name || 'usuário')
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
  const billingUrl = args.billingUrl || `${APP_URL}/perfil/plano`

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Olá, ${name}.</p>
    <p style="margin:0 0 14px 0;">Seu período de avaliação do BH Grain <strong>expirou</strong>. Para retomar suas operações, basta escolher um plano.</p>
    <div style="padding:14px 16px;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.bg};margin:0 0 14px 0;">
      <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:${COLORS.text};">Seus dados estão a salvo</p>
      <p style="margin:0;font-size:13px;color:${COLORS.textMuted};line-height:1.6;">Mantemos clientes, propostas, contratos e histórico de cotações por 30 dias. Reative seu plano a qualquer momento dentro desse prazo e tudo volta exatamente como estava.</p>
    </div>
    <p style="margin:0;font-size:13px;color:${COLORS.textFaint};">Após 30 dias, os dados são removidos definitivamente, conforme nossa política de retenção.</p>
  `

  const html = renderEmailLayout({
    title: 'Seu trial expirou',
    preheader: 'Reative seu plano para continuar operando — dados guardados por 30 dias.',
    bodyHtml,
    ctaLabel: 'Reativar agora',
    ctaUrl: billingUrl,
  })

  return {
    subject: 'Seu trial expirou',
    html,
    text: plainText(html),
  }
}
