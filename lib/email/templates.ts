/**
 * Email templates BH Grain (dark theme + accent verde).
 * HTML inline (sem Tailwind) — clientes de email não suportam CSS externo nem classes utilitárias.
 */

const COLORS = {
  bg0: '#06120B',
  bg1: '#0B1F14',
  bg2: '#11301E',
  border: '#1F4A33',
  fg1: '#ECFCEF',
  fg2: '#9DBCAB',
  fg3: '#5C7E6B',
  accent: '#1FE08C',
  accentDark: '#16A368',
}

interface ShellOpts {
  preheader?: string
  bodyHtml: string
}

function shell({ preheader = '', bodyHtml }: ShellOpts): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>BH Grain</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg0};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${COLORS.fg1};">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${COLORS.bg0};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:${COLORS.bg1};border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid ${COLORS.border};">
              <table role="presentation" width="100%"><tr>
                <td style="font-family:inherit;">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${COLORS.accent};vertical-align:middle;margin-right:8px;"></span>
                  <span style="font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${COLORS.accent};vertical-align:middle;">BH Grain</span>
                </td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${COLORS.border};background-color:${COLORS.bg0};">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.fg3};">
                BH Grain &middot; Mesa de operações de grãos<br/>
                <a href="https://www.profitsync.ia.br" style="color:${COLORS.fg3};text-decoration:underline;">www.profitsync.ia.br</a>
              </p>
              <p style="margin:8px 0 0 0;font-size:11px;color:${COLORS.fg3};">© ${new Date().getFullYear()} BH Grain. Todos os direitos reservados.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr><td style="border-radius:8px;background-color:${COLORS.accent};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:${COLORS.bg0};text-decoration:none;border-radius:8px;letter-spacing:0.3px;">${label}</a>
    </td></tr>
  </table>`
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface ResetPasswordEmailOpts {
  name: string
  resetUrl: string
}

export function resetPasswordEmail({ name, resetUrl }: ResetPasswordEmailOpts) {
  const safeName = escapeHtml(name || 'usuário')
  const bodyHtml = `
    <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${COLORS.fg3};">Recuperação de acesso</p>
    <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.3;color:${COLORS.fg1};font-weight:600;">Solicitação de redefinição de senha</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${COLORS.fg2};">Olá, ${safeName}.</p>
    <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:${COLORS.fg2};">Recebemos um pedido para redefinir a senha da sua conta no BH Grain. Clique no botão abaixo para criar uma nova senha.</p>
    ${ctaButton('Redefinir senha', resetUrl)}
    <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:${COLORS.fg3};">Ou copie e cole este link no navegador:</p>
    <p style="margin:0 0 24px 0;padding:12px;border-radius:6px;background-color:${COLORS.bg2};font-size:12px;line-height:1.5;color:${COLORS.fg2};word-break:break-all;font-family:'SF Mono',Monaco,monospace;">${escapeHtml(resetUrl)}</p>
    <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:${COLORS.fg3};">Este link expira em <strong style="color:${COLORS.fg2};">1 hora</strong>.</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:${COLORS.fg3};">Se você não solicitou a redefinição, ignore este email — sua senha permanecerá inalterada.</p>
  `
  return {
    subject: 'BH Grain · Redefinir senha',
    html: shell({ preheader: 'Crie uma nova senha para sua conta BH Grain. Link válido por 1 hora.', bodyHtml }),
    text: `Olá ${name},\n\nRecebemos um pedido para redefinir sua senha no BH Grain.\n\nAbra este link (válido por 1 hora):\n${resetUrl}\n\nSe você não solicitou, ignore este email.`,
  }
}

export interface VerifyEmailEmailOpts {
  name: string
  verifyUrl: string
}

export function verifyEmailEmail({ name, verifyUrl }: VerifyEmailEmailOpts) {
  const safeName = escapeHtml(name || 'usuário')
  const bodyHtml = `
    <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${COLORS.fg3};">Confirmação de email</p>
    <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.3;color:${COLORS.fg1};font-weight:600;">Confirme seu email</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${COLORS.fg2};">Olá, ${safeName}.</p>
    <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:${COLORS.fg2};">Para ativar sua conta no BH Grain, confirme seu endereço de email clicando no botão abaixo.</p>
    ${ctaButton('Confirmar email', verifyUrl)}
    <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:${COLORS.fg3};">Ou copie e cole este link no navegador:</p>
    <p style="margin:0 0 24px 0;padding:12px;border-radius:6px;background-color:${COLORS.bg2};font-size:12px;line-height:1.5;color:${COLORS.fg2};word-break:break-all;font-family:'SF Mono',Monaco,monospace;">${escapeHtml(verifyUrl)}</p>
    <p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:${COLORS.fg3};">Este link expira em <strong style="color:${COLORS.fg2};">24 horas</strong>.</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:${COLORS.fg3};">Se você não criou uma conta no BH Grain, ignore este email.</p>
  `
  return {
    subject: 'BH Grain · Confirme seu email',
    html: shell({ preheader: 'Ative sua conta confirmando seu email. Link válido por 24 horas.', bodyHtml }),
    text: `Olá ${name},\n\nConfirme seu email no BH Grain abrindo este link (válido por 24h):\n${verifyUrl}\n\nSe você não criou conta, ignore.`,
  }
}

export interface WelcomeEmailOpts {
  name: string
  dashboardUrl?: string
}

export function welcomeEmail({ name, dashboardUrl }: WelcomeEmailOpts) {
  const safeName = escapeHtml(name || 'usuário')
  const url = dashboardUrl || `${process.env.NEXTAUTH_URL || 'https://www.profitsync.ia.br'}/dashboard`
  const stepStyle = `padding:16px;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.bg2};margin:0 0 12px 0;`
  const numStyle = `display:inline-block;width:24px;height:24px;line-height:24px;border-radius:50%;background-color:${COLORS.accent};color:${COLORS.bg0};font-size:13px;font-weight:700;text-align:center;margin-right:10px;vertical-align:middle;`
  const bodyHtml = `
    <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${COLORS.accent};">Bem-vindo a bordo</p>
    <h1 style="margin:0 0 16px 0;font-size:26px;line-height:1.3;color:${COLORS.fg1};font-weight:600;">Olá, ${safeName}. Seja bem-vindo ao BH Grain.</h1>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:${COLORS.fg2};">Sua mesa de operações está pronta. Para começar, recomendamos três próximos passos:</p>

    <div style="${stepStyle}">
      <p style="margin:0 0 4px 0;font-size:14px;font-weight:600;color:${COLORS.fg1};"><span style="${numStyle}">1</span>Configurar sua empresa</p>
      <p style="margin:0 0 0 34px;font-size:13px;line-height:1.5;color:${COLORS.fg2};">Defina razão social, CNPJ e dados fiscais para emissão de contratos.</p>
    </div>

    <div style="${stepStyle}">
      <p style="margin:0 0 4px 0;font-size:14px;font-weight:600;color:${COLORS.fg1};"><span style="${numStyle}">2</span>Cadastrar clientes e fornecedores</p>
      <p style="margin:0 0 0 34px;font-size:13px;line-height:1.5;color:${COLORS.fg2};">Importe seu portfólio de contrapartes para começar a operar.</p>
    </div>

    <div style="${stepStyle}">
      <p style="margin:0 0 4px 0;font-size:14px;font-weight:600;color:${COLORS.fg1};"><span style="${numStyle}">3</span>Visualizar seu dashboard</p>
      <p style="margin:0 0 0 34px;font-size:13px;line-height:1.5;color:${COLORS.fg2};">Acompanhe cotações, posições e operações em tempo real.</p>
    </div>

    ${ctaButton('Acessar painel', url)}

    <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:${COLORS.fg3};">Qualquer dúvida, responda este email — nosso time está disponível para ajudar.</p>
  `
  return {
    subject: 'Bem-vindo ao BH Grain!',
    html: shell({ preheader: 'Sua conta está pronta. Veja os próximos passos para operar.', bodyHtml }),
    text: `Olá ${name},\n\nBem-vindo ao BH Grain. Próximos passos:\n1. Configurar sua empresa\n2. Cadastrar clientes e fornecedores\n3. Acessar o dashboard\n\n${url}`,
  }
}
