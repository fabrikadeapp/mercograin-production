import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface TrialEndingArgs {
  name: string
  workspaceName?: string
  daysLeft: number
  billingUrl?: string
  planName?: string
}

export function trialEndingTemplate(args: TrialEndingArgs) {
  const name = escapeHtml(args.name || 'usuário')
  const ws = escapeHtml(args.workspaceName || 'sua empresa')
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
  const billingUrl = args.billingUrl || `${APP_URL}/perfil/plano`
  const plan = escapeHtml(args.planName || 'PHB Grain')
  const days = Math.max(0, Math.round(args.daysLeft))

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Olá, ${name}.</p>
    <p style="margin:0 0 14px 0;">O período de avaliação do <strong>${plan}</strong> em ${ws} termina em <strong style="color:${COLORS.text};">${days} dia${days === 1 ? '' : 's'}</strong>.</p>
    <p style="margin:0 0 14px 0;">Para manter acesso ininterrupto a cotações ao vivo, contratos com PDF, boletos integrados e dashboard, escolha um plano antes do fim do trial.</p>
    <div style="padding:14px 16px;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.bg};margin:0 0 12px 0;">
      <p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:${COLORS.text};">O que você perde se o trial expirar:</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:${COLORS.textMuted};line-height:1.6;">
        <li>Acesso a cotações ao vivo e histórico</li>
        <li>Geração de propostas e contratos em PDF</li>
        <li>Cobrança via boleto integrada</li>
        <li>Alertas de preço e relatórios</li>
      </ul>
    </div>
    <p style="margin:14px 0 0 0;font-size:13px;color:${COLORS.textFaint};">Seus dados continuam guardados por até 30 dias após o vencimento.</p>
  `

  const html = renderEmailLayout({
    title: `Seu trial termina em ${days} dia${days === 1 ? '' : 's'}`,
    preheader: `Faltam ${days} dia${days === 1 ? '' : 's'} para o fim do seu trial — escolha seu plano.`,
    bodyHtml,
    ctaLabel: 'Escolher plano',
    ctaUrl: billingUrl,
  })

  return {
    subject: `Seu trial termina em ${days} dia${days === 1 ? '' : 's'}`,
    html,
    text: plainText(html),
  }
}
