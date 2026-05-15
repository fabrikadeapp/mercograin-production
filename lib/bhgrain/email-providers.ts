/**
 * BH Grain — Presets de provedores de e-mail.
 *
 * Quando o cliente do workspace adiciona uma conta de e-mail no
 * /configuracoes/integracoes, ele escolhe um provedor desta lista.
 * Cada provedor traz host/porta/TLS pré-preenchidos e instruções
 * específicas (ex.: como gerar senha de app no Gmail).
 *
 * O provedor 'custom' é o fallback genérico — serve Zoho, cPanel,
 * Hostinger, ProtonMail Bridge, qualquer servidor IMAP/SMTP.
 */

export type EmailProviderId = 'gmail' | 'outlook' | 'hotmail' | 'custom'

export interface EmailProviderPreset {
  id: EmailProviderId
  /** Nome exibido nos cards do wizard. */
  label: string
  /** Curto descritor (ex.: 'Google Workspace · @gmail.com'). */
  hint: string
  /** Emoji ou cor de avatar (a UI escolhe como renderizar). */
  swatch: string
  /** Defaults IMAP. host vazio em 'custom' (user preenche). */
  imap: { host: string; port: number; tls: boolean }
  /** Defaults SMTP. */
  smtp: { host: string; port: number; tls: boolean }
  /** Texto explicativo curto que aparece no topo do form. */
  helpText: string
  /** Link externo (ex.: gerar app password). */
  helpUrl?: string
  /** Texto do botão do link externo. */
  helpUrlLabel?: string
  /** True quando provedor exige senha-de-aplicativo (2FA + app password). */
  requiresAppPassword: boolean
  /** Sufixos de e-mail aceitos (heurística para auto-sugerir o preset).
   *  Ex.: ['@gmail.com'] → se cliente digitar joao@gmail.com no campo email,
   *  sugerimos 'gmail' automaticamente. */
  emailHints: string[]
}

export const EMAIL_PROVIDERS: Record<EmailProviderId, EmailProviderPreset> = {
  gmail: {
    id: 'gmail',
    label: 'Gmail / Google Workspace',
    hint: '@gmail.com · Google Workspace',
    swatch: '#EA4335',
    imap: { host: 'imap.gmail.com', port: 993, tls: true },
    smtp: { host: 'smtp.gmail.com', port: 587, tls: true },
    helpText:
      'Ative a verificação em 2 etapas e gere uma "Senha de app" para o Mail. Use a senha de app no campo abaixo (não a senha normal da conta).',
    helpUrl: 'https://myaccount.google.com/apppasswords',
    helpUrlLabel: 'Gerar senha de app no Google',
    requiresAppPassword: true,
    emailHints: ['@gmail.com', '@googlemail.com'],
  },

  outlook: {
    id: 'outlook',
    label: 'Outlook / Microsoft 365',
    hint: '@outlook.com · Office 365 · Exchange Online',
    swatch: '#0078D4',
    imap: { host: 'outlook.office365.com', port: 993, tls: true },
    smtp: { host: 'smtp.office365.com', port: 587, tls: true },
    helpText:
      'Em contas com 2FA ativado, é necessário gerar uma senha de app no portal Microsoft. Em contas Microsoft 365 corporativas, o admin pode precisar liberar IMAP no portal de administração.',
    helpUrl: 'https://account.microsoft.com/security',
    helpUrlLabel: 'Segurança da conta Microsoft',
    requiresAppPassword: true,
    emailHints: ['@outlook.com', '@office365.com'],
  },

  hotmail: {
    id: 'hotmail',
    label: 'Hotmail / Live',
    hint: '@hotmail.com · @live.com · @msn.com',
    swatch: '#0078D4',
    imap: { host: 'outlook.office365.com', port: 993, tls: true },
    smtp: { host: 'smtp.office365.com', port: 587, tls: true },
    helpText:
      'Hotmail/Live usam a mesma infra do Outlook. Se sua conta tem 2FA ativo, gere uma senha de app na segurança da conta Microsoft.',
    helpUrl: 'https://account.live.com/proofs/AppPassword',
    helpUrlLabel: 'Gerar senha de app',
    requiresAppPassword: true,
    emailHints: ['@hotmail.com', '@live.com', '@msn.com'],
  },

  custom: {
    id: 'custom',
    label: 'Outro provedor',
    hint: 'Zoho · cPanel · Hostinger · servidor próprio',
    swatch: '#6B7280',
    imap: { host: '', port: 993, tls: true },
    smtp: { host: '', port: 587, tls: true },
    helpText:
      'Use os dados que seu provedor de hospedagem ou administrador de e-mail forneceu. Em geral o host é mail.seudominio.com ou imap.seudominio.com. Porta 993 (IMAP TLS) e 587 (SMTP STARTTLS) funcionam na maioria dos casos.',
    requiresAppPassword: false,
    emailHints: [],
  },
}

/** Lista ordenada para grids da UI. */
export const EMAIL_PROVIDERS_LIST: EmailProviderPreset[] = [
  EMAIL_PROVIDERS.gmail,
  EMAIL_PROVIDERS.outlook,
  EMAIL_PROVIDERS.hotmail,
  EMAIL_PROVIDERS.custom,
]

/** Tenta inferir o provedor pelo sufixo do e-mail. */
export function detectProviderByEmail(email: string): EmailProviderId {
  const lower = email.trim().toLowerCase()
  for (const p of EMAIL_PROVIDERS_LIST) {
    if (p.emailHints.some((h) => lower.endsWith(h))) return p.id
  }
  return 'custom'
}

/** Aplica os defaults do provedor a um objeto parcial de config. */
export function applyProviderDefaults(
  providerId: EmailProviderId,
  partial: { imapUser?: string; smtpUser?: string; fromEmail?: string } = {}
): {
  imapHost: string
  imapPort: number
  imapTls: boolean
  smtpHost: string
  smtpPort: number
  smtpTls: boolean
} {
  const p = EMAIL_PROVIDERS[providerId]
  return {
    imapHost: p.imap.host,
    imapPort: p.imap.port,
    imapTls: p.imap.tls,
    smtpHost: p.smtp.host,
    smtpPort: p.smtp.port,
    smtpTls: p.smtp.tls,
  }
}
