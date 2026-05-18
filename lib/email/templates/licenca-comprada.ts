import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface LicencaCompradaArgs {
  /** Nome do comprador (cai pro email se ausente). */
  nome: string
  /** Email do comprador (mostrado no rodapé). */
  email: string
  /** Código da licença formato BHG-YYYY-XXXXXX. */
  codigoLicenca: string
  /** Nome amigável do plano (ex: "Pro", "Starter"). */
  planoNome: string
  /** URL completa para /ativar/{token}. */
  ativarUrl: string
  /** Validade em dias do link mágico (default 7). */
  validadeDias?: number
}

export function licencaCompradaTemplate(args: LicencaCompradaArgs) {
  const nome = escapeHtml(args.nome || args.email || 'cliente')
  const email = escapeHtml(args.email)
  const codigo = escapeHtml(args.codigoLicenca)
  const plano = escapeHtml(args.planoNome)
  const validade = args.validadeDias ?? 7

  const codigoBox = `
    <div style="margin:24px 0 8px 0;padding:18px 20px;border:1px solid ${COLORS.border};border-radius:10px;background-color:${COLORS.bg};text-align:center;">
      <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${COLORS.textFaint};margin-bottom:6px;">CÓDIGO DA LICENÇA</div>
      <div style="font-family:'SF Mono','Menlo','Consolas',monospace;font-size:22px;font-weight:700;letter-spacing:2px;color:${COLORS.accent};">${codigo}</div>
    </div>
  `

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Olá, <strong style="color:${COLORS.text};">${nome}</strong>. Pagamento confirmado — sua licença <strong>BH Grain ${plano}</strong> está pronta.</p>
    ${codigoBox}
    <p style="margin:16px 0 16px 0;">Para começar, clique no botão abaixo. Você vai:</p>
    <ol style="margin:0 0 16px 18px;padding:0;color:${COLORS.textMuted};">
      <li style="margin-bottom:6px;">Criar uma senha pra acessar o painel.</li>
      <li style="margin-bottom:6px;">Preencher os dados da sua empresa (razão social, CNPJ).</li>
      <li>Entrar direto na mesa de operações.</li>
    </ol>
    <p style="margin:16px 0 0 0;font-size:13px;color:${COLORS.textFaint};">
      Este link é único e válido por <strong>${validade} dias</strong>. Após esse prazo, peça um novo na página de suporte ou responda este e-mail.
    </p>
    <p style="margin:14px 0 0 0;font-size:12px;color:${COLORS.textFaint};">
      Guarde o código <strong>${codigo}</strong> — ele identifica sua licença em todo suporte futuro.
    </p>
    <p style="margin:18px 0 0 0;font-size:12px;color:${COLORS.textFaint};">
      Compra registrada em ${email}.
    </p>
  `

  const html = renderEmailLayout({
    title: 'Sua licença BH Grain está pronta',
    preheader: `Código ${args.codigoLicenca} — configure sua conta agora.`,
    bodyHtml,
    ctaLabel: 'Configurar minha conta agora',
    ctaUrl: args.ativarUrl,
    footerNote: `Link válido por ${validade} dias. Dúvidas? Responda este e-mail.`,
  })

  return {
    subject: `Sua licença BH Grain está pronta — código ${args.codigoLicenca}`,
    html,
    text: plainText(html),
  }
}
