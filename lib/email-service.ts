import nodemailer from 'nodemailer'
import { Resend } from 'resend'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export interface SendEmailResult {
  ok: boolean
  id?: string
  skipped?: boolean
  provider?: 'resend' | 'smtp' | 'none'
  error?: string
}

/**
 * Email service unificado.
 * Prioridade: Resend (RESEND_API_KEY) > SMTP (EMAIL_PASSWORD) > log-only.
 * Sempre degrada graciosamente — nunca lança em ausência de provider.
 */

let resendClient: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY)
  return resendClient
}

let smtpTransporter: nodemailer.Transporter | null = null
function getSmtpTransporter(): nodemailer.Transporter | null {
  if (!process.env.EMAIL_PASSWORD) return null
  if (smtpTransporter) return smtpTransporter
  smtpTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_FROM_SMTP || process.env.EMAIL_FROM || '',
      pass: process.env.EMAIL_PASSWORD,
    },
  })
  return smtpTransporter
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || 'BH Grain <noreply@profitsync.ia.br>'
}

export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  const resend = getResend()
  if (resend) {
    try {
      const result = await resend.emails.send({
        from: fromAddress(),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      })
      if (result.error) {
        console.error('[email] resend error:', result.error)
        return { ok: false, provider: 'resend', error: String(result.error.message || result.error) }
      }
      console.log(`[email] resend ok → ${options.to} (${options.subject})`)
      return { ok: true, provider: 'resend', id: result.data?.id }
    } catch (err) {
      console.error('[email] resend exception:', err)
      return { ok: false, provider: 'resend', error: err instanceof Error ? err.message : 'unknown' }
    }
  }

  const smtp = getSmtpTransporter()
  if (smtp) {
    try {
      const info = await smtp.sendMail({
        from: fromAddress(),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      })
      console.log(`[email] smtp ok → ${options.to} (${options.subject})`)
      return { ok: true, provider: 'smtp', id: info.messageId }
    } catch (err) {
      console.error('[email] smtp exception:', err)
      return { ok: false, provider: 'smtp', error: err instanceof Error ? err.message : 'unknown' }
    }
  }

  console.warn(`[email] sem provider configurado (RESEND_API_KEY ausente). Email NÃO enviado: "${options.subject}" → ${options.to}`)
  return { ok: false, skipped: true, provider: 'none' }
}

// =====================================================================
// Templates legados (mantidos para compatibilidade com módulos não-auth).
// Para auth, usar lib/email/templates.ts
// =====================================================================
export const emailTemplates = {
  resetPassword: (token: string, userName: string) => {
    const url = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`
    return {
      subject: 'BH Grain · Redefinir senha',
      html: `<p>Olá ${userName}, redefina sua senha: <a href="${url}">${url}</a> (expira em 1 hora)</p>`,
      text: `Redefinir senha: ${url}`,
    }
  },

  proposalSent: (clienteName: string, proposalNumber: string) => ({
    subject: `Proposta ${proposalNumber} Enviada - BH Grain`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Nova Proposta Enviada</h2>
        <p style="color: #666; font-size: 16px;">
          A proposta <strong>#${proposalNumber}</strong> foi enviada para <strong>${clienteName}</strong>.
        </p>
        <a href="${process.env.NEXTAUTH_URL}/propostas"
           style="display: inline-block; background-color: #1FE08C; color: #06120B; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: bold;">
          Ver Proposta
        </a>
      </div>
    `,
  }),

  boletoCreated: (clienteName: string, boletoNumber: string, dueDate: string, value: string) => ({
    subject: `Boleto ${boletoNumber} - BH Grain`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Boleto Criado</h2>
        <p style="color: #666; font-size: 16px;">
          Um novo boleto foi criado para <strong>${clienteName}</strong>.
        </p>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Número:</strong> ${boletoNumber}</p>
          <p><strong>Valor:</strong> ${value}</p>
          <p><strong>Vencimento:</strong> ${dueDate}</p>
        </div>
        <a href="${process.env.NEXTAUTH_URL}/boletos"
           style="display: inline-block; background-color: #1FE08C; color: #06120B; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: bold;">
          Ver Boleto
        </a>
      </div>
    `,
  }),

  boleteOverdue: (clienteName: string, boletoNumber: string, daysOverdue: number) => ({
    subject: `Boleto ${boletoNumber} Vencido - BH Grain`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #d97706;">Boleto Vencido</h2>
        <p style="color: #666; font-size: 16px;">
          O boleto <strong>#${boletoNumber}</strong> de <strong>${clienteName}</strong> venceu há <strong>${daysOverdue} dia(s)</strong>.
        </p>
        <p style="color: #dc2626; font-weight: bold;">
          Por favor, entre em contato para resolver o pagamento.
        </p>
        <a href="${process.env.NEXTAUTH_URL}/boletos"
           style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: bold;">
          Ver Boleto
        </a>
      </div>
    `,
  }),
}
