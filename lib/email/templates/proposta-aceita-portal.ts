/**
 * Template: cliente aceitou proposta no portal — avisa o vendedor/gerente.
 *
 * Disparado em POST /api/portal/propostas/[id]/aceitar.
 */
import { renderEmailLayout, plainText, escapeHtml, COLORS } from '../layout'

export interface PropostaAceitaPortalArgs {
  /** Quem recebe (vendedor ou gerente da conta). */
  destinatarioNome: string
  /** Nome da empresa/cliente que aceitou. */
  clienteNome: string
  /** Nome de quem clicou no portal (pode ser representante). */
  aceitanteNome: string
  /** Ex: MCG2026060501P */
  propostaNumero: string
  /** Valor formatado (R$ X.XXX,XX). */
  valorFormatado: string
  /** Número do contrato gerado, se disponível. */
  contratoNumero?: string | null
  /** URL para abrir a proposta/contrato no sistema interno. */
  linkInterno: string
  /** ISO timestamp do aceite. */
  aceitoEm: string
}

export function propostaAceitaPortalTemplate(args: PropostaAceitaPortalArgs) {
  const destinatario = escapeHtml(args.destinatarioNome)
  const cliente = escapeHtml(args.clienteNome)
  const aceitante = escapeHtml(args.aceitanteNome)
  const numero = escapeHtml(args.propostaNumero)
  const contrato = args.contratoNumero ? escapeHtml(args.contratoNumero) : null
  const valor = escapeHtml(args.valorFormatado)
  const aceitoEm = new Date(args.aceitoEm).toLocaleString('pt-BR')

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">Olá ${destinatario},</p>
    <p style="margin:0 0 14px 0;">
      A proposta <strong style="font-family:'SF Mono',Monaco,monospace;">${numero}</strong>
      foi <strong style="color:#0a7d36;">ACEITA</strong> pelo cliente
      <strong>${cliente}</strong> via portal.
    </p>
    <div style="padding:14px 16px;border:1px solid ${COLORS.border};border-radius:8px;background-color:${COLORS.bg};margin:0 0 14px 0;">
      <p style="margin:0 0 6px 0;font-size:13px;color:${COLORS.textMuted};">Resumo:</p>
      <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.55;">
        <li>Aceite registrado por: <strong>${aceitante}</strong></li>
        <li>Valor: <strong>${valor}</strong></li>
        <li>Aceito em: ${aceitoEm}</li>
        ${contrato ? `<li>Contrato gerado: <strong style="font-family:'SF Mono',Monaco,monospace;">${contrato}</strong></li>` : '<li style="color:#b85;">Atenção: contrato não foi gerado automaticamente. Verifique o template padrão.</li>'}
      </ul>
    </div>
    <p style="margin:0;font-size:13px;color:${COLORS.textMuted};">
      Acesse o sistema para acompanhar a próxima etapa: envio para assinatura digital.
    </p>
  `

  const html = renderEmailLayout({
    title: `Proposta ${args.propostaNumero} aceita por ${args.clienteNome}`,
    preheader: `${args.clienteNome} aceitou ${args.propostaNumero} (${args.valorFormatado})`,
    bodyHtml,
    ctaLabel: contrato ? `Abrir contrato ${contrato}` : 'Abrir proposta no sistema',
    ctaUrl: args.linkInterno,
  })

  return {
    subject: `✓ Proposta ${args.propostaNumero} aceita — ${args.clienteNome}`,
    html,
    text: plainText(html),
  }
}
