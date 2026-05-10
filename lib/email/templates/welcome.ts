import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface WelcomeArgs {
  name: string
  workspaceName?: string
  dashboardUrl?: string
}

export function welcomeTemplate(args: WelcomeArgs) {
  const name = escapeHtml(args.name || 'usuário')
  const ws = escapeHtml(args.workspaceName || 'sua empresa')
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'
  const dashboardUrl = args.dashboardUrl || `${APP_URL}/dashboard`

  const stepBox = `padding:14px 16px;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.bg};margin:0 0 10px 0;`

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Olá, <strong style="color:${COLORS.text};">${name}</strong>. Sua conta no <strong>PHB Grain</strong> foi criada — bem-vindo(a) a bordo (${ws}).</p>
    <p style="margin:0 0 18px 0;">Para começar a operar, recomendamos três próximos passos:</p>
    <div style="${stepBox}">
      <p style="margin:0 0 4px 0;font-size:14px;font-weight:600;color:${COLORS.text};">1. Cadastrar seu primeiro cliente</p>
      <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">Importe contrapartes (compradores e vendedores) para começar a registrar propostas.</p>
    </div>
    <div style="${stepBox}">
      <p style="margin:0 0 4px 0;font-size:14px;font-weight:600;color:${COLORS.text};">2. Acompanhar cotações ao vivo</p>
      <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">Soja, milho e trigo em tempo real (CEPEA + CBOT) com conversão USD/BRL.</p>
    </div>
    <div style="${stepBox}">
      <p style="margin:0 0 4px 0;font-size:14px;font-weight:600;color:${COLORS.text};">3. Criar sua primeira proposta</p>
      <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">Monte propostas com tabela de grãos e exporte em PDF com a sua marca.</p>
    </div>
  `

  const html = renderEmailLayout({
    title: `Bem-vindo(a) ao PHB Grain, ${args.name}`,
    preheader: 'Sua mesa de operações está pronta. Veja os próximos passos.',
    bodyHtml,
    ctaLabel: 'Acessar painel',
    ctaUrl: dashboardUrl,
    footerNote: 'Qualquer dúvida, responda este email — nosso time está disponível.',
  })

  return {
    subject: `Bem-vindo(a) ao PHB Grain, ${args.name} 🌾`,
    html,
    text: plainText(html),
  }
}
