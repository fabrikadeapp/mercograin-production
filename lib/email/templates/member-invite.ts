import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface MemberInviteArgs {
  invitedEmail: string
  inviterName: string
  workspaceName: string
  cargo?: string | null
  areas: string[]
  acceptUrl: string
}

const AREA_LABEL: Record<string, string> = {
  mesa: 'Mesa (Vendas)',
  financeiro: 'Financeiro',
  fiscal: 'Fiscal',
  gestao: 'Gestão',
}

export function memberInviteTemplate(args: MemberInviteArgs) {
  const email = escapeHtml(args.invitedEmail)
  const inviter = escapeHtml(args.inviterName)
  const ws = escapeHtml(args.workspaceName)
  const cargo = args.cargo ? escapeHtml(args.cargo) : null
  const areas = args.areas.map((a) => AREA_LABEL[a] ?? a)

  const areasHtml =
    areas.length > 0
      ? `<div style="margin:0 0 18px 0;">${areas
          .map(
            (a) =>
              `<span style="display:inline-block;padding:4px 10px;margin:2px 4px 2px 0;border:1px solid ${COLORS.border};border-radius:999px;font-size:12px;color:${COLORS.text};background-color:${COLORS.bg};">${escapeHtml(a)}</span>`,
          )
          .join('')}</div>`
      : ''

  const cargoHtml = cargo
    ? `<p style="margin:0 0 8px 0;font-size:14px;color:${COLORS.textMuted};">Cargo: <strong style="color:${COLORS.text};">${cargo}</strong></p>`
    : ''

  const bodyHtml = `
    <p style="margin:0 0 12px 0;">Olá,</p>
    <p style="margin:0 0 18px 0;"><strong style="color:${COLORS.text};">${inviter}</strong> convidou você (<strong>${email}</strong>) para acessar a licença <strong>${ws}</strong> no BH Grain.</p>
    ${cargoHtml}
    ${
      areas.length > 0
        ? `<p style="margin:0 0 8px 0;font-size:13px;color:${COLORS.textMuted};">Você terá acesso às áreas:</p>${areasHtml}`
        : ''
    }
    <p style="margin:0 0 18px 0;">Clique no botão abaixo para aceitar o convite e criar (ou vincular) sua conta. O link expira em 14 dias.</p>
  `

  const html = renderEmailLayout({
    title: `${inviter} convidou você para ${ws}`,
    preheader: `Aceite o convite para acessar ${ws} no BH Grain.`,
    bodyHtml,
    ctaLabel: 'Aceitar convite',
    ctaUrl: args.acceptUrl,
    footerNote:
      'Se você não esperava este convite, basta ignorar este email — nenhuma conta será criada sem sua confirmação.',
  })

  return {
    subject: `${inviter} convidou você para ${ws} no BH Grain`,
    html,
    text: plainText(html),
  }
}
