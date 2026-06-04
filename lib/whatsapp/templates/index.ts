/**
 * Templates de notificação WhatsApp.
 *
 * Mantemos PT-BR direto, formato compatível com WhatsApp (emoji + *negrito*
 * funciona, /itálico/ funciona, sem HTML). Cada template retorna apenas a
 * string final; o caller decide pra qual número manda via lib/whatsapp/evolution.
 *
 * Princípio: NUNCA mais de 500 caracteres por mensagem. Cliente lê no celular
 * em 5 segundos. Detalhe vai no link.
 */

const SUFIXO = '\n\n_Enviado automaticamente pelo sistema_'

export interface ResumoProposta {
  numero: string
  clienteNome: string
  workspaceNome: string
  valorFormatado: string
  validadeFormatada: string
  graoResumo?: string // ex: "1000sc soja a R$130/sc"
}

/** Resumo curto reutilizável (uma linha). */
export function linhaResumoProposta(args: ResumoProposta): string {
  const partes: string[] = []
  if (args.graoResumo) partes.push(args.graoResumo)
  partes.push(args.valorFormatado)
  return partes.join(' · ')
}

// ─────────────────────────────────────────────
// Template 1 — Proposta enviada (pro cliente)
// ─────────────────────────────────────────────
export interface PropostaEnviadaArgs extends ResumoProposta {
  portalUrl: string
}

export function whatsPropostaEnviada(args: PropostaEnviadaArgs): string {
  const lines = [
    `🌾 *Nova proposta — ${args.workspaceNome}*`,
    ``,
    `Olá ${args.clienteNome},`,
    ``,
    `Você recebeu a proposta *${args.numero}*.`,
    ``,
    `${linhaResumoProposta(args)}`,
    `📅 Validade: ${args.validadeFormatada}`,
    ``,
    `Acesse para aceitar ou recusar:`,
    args.portalUrl,
  ]
  return lines.join('\n') + SUFIXO
}

// ─────────────────────────────────────────────
// Template 2 — Proposta aceita (pro time vendedor)
// ─────────────────────────────────────────────
export interface PropostaAceitaArgs {
  destinatarioNome: string
  clienteNome: string
  aceitanteNome: string
  comentario?: string
  propostaNumero: string
  valorFormatado: string
  contratoNumero?: string | null
  linkInterno: string
}

export function whatsPropostaAceita(args: PropostaAceitaArgs): string {
  const lines = [
    `✅ *Proposta aceita!*`,
    ``,
    `Olá ${args.destinatarioNome},`,
    ``,
    `*${args.clienteNome}* aceitou a proposta *${args.propostaNumero}* (${args.valorFormatado}).`,
    `Registrado por: ${args.aceitanteNome}`,
  ]
  if (args.comentario) {
    lines.push(``, `💬 _"${args.comentario}"_`)
  }
  if (args.contratoNumero) {
    lines.push(``, `📄 Contrato *${args.contratoNumero}* já foi criado.`)
  } else {
    lines.push(``, `⚠️ Atenção: contrato não foi gerado automaticamente.`)
  }
  lines.push(``, `Acessar no sistema:`, args.linkInterno)
  return lines.join('\n') + SUFIXO
}

// ─────────────────────────────────────────────
// Template 3 — Contrato gerado (pro cliente)
// ─────────────────────────────────────────────
export interface ContratoGeradoArgs {
  clienteNome: string
  workspaceNome: string
  contratoNumero: string
  propostaNumero: string
  valorFormatado: string
  portalUrl: string
}

export function whatsContratoGerado(args: ContratoGeradoArgs): string {
  const lines = [
    `📄 *Contrato pronto — ${args.workspaceNome}*`,
    ``,
    `Olá ${args.clienteNome},`,
    ``,
    `Seu contrato *${args.contratoNumero}* foi gerado a partir da proposta ${args.propostaNumero} (${args.valorFormatado}).`,
    ``,
    `Em breve você receberá o link para assinatura digital.`,
    ``,
    `Acompanhe o status:`,
    args.portalUrl,
  ]
  return lines.join('\n') + SUFIXO
}
