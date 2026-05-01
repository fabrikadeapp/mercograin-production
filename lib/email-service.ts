import nodemailer from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (transporter) return transporter

  // Gmail SMTP (use app password if 2FA enabled)
  // Ou configure seu próprio SMTP
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_FROM || 'seu-email@gmail.com',
      pass: process.env.EMAIL_PASSWORD || 'sua-senha-app',
    },
  })

  return transporter
}

export async function sendEmail(options: EmailOptions) {
  try {
    const mailer = getTransporter()

    const result = await mailer.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@mercograin.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })

    console.log(`[Email] Enviado para ${options.to}: ${options.subject}`)
    return result
  } catch (error) {
    console.error('[Email] Erro ao enviar:', error)
    throw new Error(`Erro ao enviar email: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
}

// Templates de email
export const emailTemplates = {
  resetPassword: (token: string, userName: string) => ({
    subject: '🔑 Recuperar Senha - MercoGrain',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Olá ${userName},</h2>
        <p style="color: #666; font-size: 16px;">
          Você solicitou a recuperação de senha para sua conta MercoGrain.
        </p>
        <p style="color: #666; font-size: 16px;">
          Clique no link abaixo para criar uma nova senha:
        </p>

        <a href="${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}"
           style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: bold;">
          Recuperar Senha
        </a>

        <p style="color: #999; font-size: 14px;">
          Ou copie e cole este link no navegador:<br/>
          <code style="background: #f0f0f0; padding: 8px; display: block; margin: 10px 0; word-break: break-all;">
            ${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}
          </code>
        </p>

        <p style="color: #999; font-size: 14px;">
          Este link expira em 1 hora.
        </p>

        <p style="color: #999; font-size: 14px;">
          Se você não solicitou isto, ignore este email.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          MercoGrain © ${new Date().getFullYear()}
        </p>
      </div>
    `,
    text: `Recuperar Senha - MercoGrain\n\nOlá ${userName},\n\nVocê solicitou recuperação de senha.\n\nClique aqui para criar uma nova senha:\n${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}\n\nEste link expira em 1 hora.`,
  }),

  proposalSent: (clienteName: string, proposalNumber: string) => ({
    subject: `📋 Proposta ${proposalNumber} Enviada - MercoGrain`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Nova Proposta Enviada</h2>
        <p style="color: #666; font-size: 16px;">
          A proposta <strong>#${proposalNumber}</strong> foi enviada para <strong>${clienteName}</strong>.
        </p>
        <a href="${process.env.NEXTAUTH_URL}/propostas"
           style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: bold;">
          Ver Proposta
        </a>
      </div>
    `,
  }),

  boletoCreated: (clienteName: string, boletoNumber: string, dueDate: string, value: string) => ({
    subject: `💰 Boleto ${boletoNumber} - MercoGrain`,
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
           style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: bold;">
          Ver Boleto
        </a>
      </div>
    `,
  }),

  boleteOverdue: (clienteName: string, boletoNumber: string, daysOverdue: number) => ({
    subject: `⚠️ Boleto ${boletoNumber} Vencido - MercoGrain`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #d97706;">Boleto Vencido</h2>
        <p style="color: #666; font-size: 16px;">
          O boleto <strong>#${boletoNumber}</strong> de <strong>${clienteName}</strong> venceu há <strong>${daysOverdue} dia(s)</strong>.
        </p>
        <p style="color: #dc2626; font-weight: bold;">
          ⚠️ Por favor, entre em contato para resolver o pagamento.
        </p>
        <a href="${process.env.NEXTAUTH_URL}/boletos"
           style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; font-weight: bold;">
          Ver Boleto
        </a>
      </div>
    `,
  }),
}
