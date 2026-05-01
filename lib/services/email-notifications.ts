import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASSWORD,
  },
})

interface NotificacaoBoleto {
  tipo: 'boleto_criado' | 'boleto_vencido' | 'boleto_pago'
  numero: string
  cliente: string
  valor: number
  vencimento?: string
  email: string
}

interface NotificacaoProposta {
  tipo: 'proposta_enviada' | 'proposta_aceita' | 'proposta_rejeitada'
  numero: string
  cliente: string
  valor: number
  email: string
}

interface NotificacaoContrato {
  tipo: 'contrato_criado' | 'contrato_assinado'
  numero: string
  proposta: string
  email: string
}

export async function enviarNotificacaoBoleto(notif: NotificacaoBoleto) {
  try {
    const templates: Record<string, { subject: string; html: (data: NotificacaoBoleto) => string }> = {
      boleto_criado: {
        subject: `Novo Boleto #${notif.numero}`,
        html: (data) => `
          <h2>Novo Boleto Criado</h2>
          <p>Um novo boleto foi criado para o cliente <strong>${data.cliente}</strong></p>
          <div style="background: #f0f0f0; padding: 15px; border-radius: 5px;">
            <p><strong>Número:</strong> BLT-${data.numero}</p>
            <p><strong>Valor:</strong> R$ ${(data.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            ${data.vencimento ? `<p><strong>Vencimento:</strong> ${new Date(data.vencimento).toLocaleDateString('pt-BR')}</p>` : ''}
          </div>
        `,
      },
      boleto_vencido: {
        subject: `⚠️ Boleto Vencido #${notif.numero}`,
        html: (data) => `
          <h2 style="color: #d32f2f;">Boleto Vencido!</h2>
          <p>O boleto <strong>BLT-${data.numero}</strong> do cliente <strong>${data.cliente}</strong> está vencido.</p>
          <div style="background: #ffebee; padding: 15px; border-radius: 5px; border-left: 4px solid #d32f2f;">
            <p><strong>Valor:</strong> R$ ${(data.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p><strong>Status:</strong> Vencido</p>
          </div>
          <p style="margin-top: 20px;">Por favor, entre em contato com o cliente ou acesse o dashboard para mais informações.</p>
        `,
      },
      boleto_pago: {
        subject: `✅ Boleto Pago #${notif.numero}`,
        html: (data) => `
          <h2 style="color: #4caf50;">Boleto Pago</h2>
          <p>O boleto <strong>BLT-${data.numero}</strong> foi pago pelo cliente <strong>${data.cliente}</strong></p>
          <div style="background: #e8f5e9; padding: 15px; border-radius: 5px; border-left: 4px solid #4caf50;">
            <p><strong>Valor:</strong> R$ ${(data.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p><strong>Status:</strong> Pago</p>
          </div>
        `,
      },
    }

    const template = templates[notif.tipo]
    if (!template) throw new Error(`Template não encontrado: ${notif.tipo}`)

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: notif.email,
      subject: template.subject,
      html: template.html(notif),
    })

    return { success: true }
  } catch (error) {
    console.error('Erro ao enviar notificação de boleto:', error)
    return { success: false, error }
  }
}

export async function enviarNotificacaoProposta(notif: NotificacaoProposta) {
  try {
    const templates: Record<string, { subject: string; html: (data: NotificacaoProposta) => string }> = {
      proposta_enviada: {
        subject: `Proposta #${notif.numero} Enviada`,
        html: (data) => `
          <h2>Proposta Enviada</h2>
          <p>Sua proposta foi enviada para <strong>${data.cliente}</strong></p>
          <div style="background: #f0f0f0; padding: 15px; border-radius: 5px;">
            <p><strong>Número:</strong> PROP-${data.numero}</p>
            <p><strong>Cliente:</strong> ${data.cliente}</p>
            <p><strong>Valor:</strong> R$ ${(data.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        `,
      },
      proposta_aceita: {
        subject: `✅ Proposta #${notif.numero} Aceita!`,
        html: (data) => `
          <h2 style="color: #4caf50;">Proposta Aceita!</h2>
          <p>A proposta <strong>PROP-${data.numero}</strong> foi aceita pelo cliente <strong>${data.cliente}</strong></p>
          <div style="background: #e8f5e9; padding: 15px; border-radius: 5px; border-left: 4px solid #4caf50;">
            <p><strong>Valor:</strong> R$ ${(data.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p><strong>Status:</strong> Aceita</p>
          </div>
          <p style="margin-top: 20px;">Próximo passo: criar o contrato correspondente.</p>
        `,
      },
      proposta_rejeitada: {
        subject: `❌ Proposta #${notif.numero} Rejeitada`,
        html: (data) => `
          <h2 style="color: #d32f2f;">Proposta Rejeitada</h2>
          <p>A proposta <strong>PROP-${notif.numero}</strong> foi rejeitada pelo cliente <strong>${data.cliente}</strong></p>
          <div style="background: #ffebee; padding: 15px; border-radius: 5px; border-left: 4px solid #d32f2f;">
            <p><strong>Valor:</strong> R$ ${(data.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p><strong>Status:</strong> Rejeitada</p>
          </div>
        `,
      },
    }

    const template = templates[notif.tipo]
    if (!template) throw new Error(`Template não encontrado: ${notif.tipo}`)

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: notif.email,
      subject: template.subject,
      html: template.html(notif),
    })

    return { success: true }
  } catch (error) {
    console.error('Erro ao enviar notificação de proposta:', error)
    return { success: false, error }
  }
}

export async function enviarNotificacaoContrato(notif: NotificacaoContrato) {
  try {
    const templates: Record<string, { subject: string; html: (data: NotificacaoContrato) => string }> = {
      contrato_criado: {
        subject: `Novo Contrato #${notif.numero}`,
        html: (data) => `
          <h2>Novo Contrato Criado</h2>
          <p>Um novo contrato foi criado a partir da proposta <strong>PROP-${data.proposta}</strong></p>
          <div style="background: #f0f0f0; padding: 15px; border-radius: 5px;">
            <p><strong>Número do Contrato:</strong> CTR-${data.numero}</p>
            <p><strong>Proposta Relacionada:</strong> PROP-${data.proposta}</p>
          </div>
        `,
      },
      contrato_assinado: {
        subject: `✅ Contrato #${notif.numero} Assinado`,
        html: (data) => `
          <h2 style="color: #4caf50;">Contrato Assinado</h2>
          <p>O contrato <strong>CTR-${data.numero}</strong> foi marcado como assinado</p>
          <div style="background: #e8f5e9; padding: 15px; border-radius: 5px; border-left: 4px solid #4caf50;">
            <p><strong>Contrato:</strong> CTR-${data.numero}</p>
            <p><strong>Status:</strong> Assinado</p>
          </div>
          <p style="margin-top: 20px;">Próximo passo: criar boleto para cobrança.</p>
        `,
      },
    }

    const template = templates[notif.tipo]
    if (!template) throw new Error(`Template não encontrado: ${notif.tipo}`)

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: notif.email,
      subject: template.subject,
      html: template.html(notif),
    })

    return { success: true }
  } catch (error) {
    console.error('Erro ao enviar notificação de contrato:', error)
    return { success: false, error }
  }
}
