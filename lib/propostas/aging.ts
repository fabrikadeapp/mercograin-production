/**
 * Calcula o "aging" da validade de uma proposta — usado pra colorir badges
 * no book e priorizar ações do operador.
 */

export type AgingNivel = 'vencida' | 'hoje' | 'urgente' | 'proxima' | 'ok' | 'sem-validade'

export interface AgingInfo {
  nivel: AgingNivel
  diasRestantes: number | null
  label: string
  cor: 'neg' | 'warn' | 'info' | 'fg-3' | 'fg-2'
}

/** Recebe Date | string ISO | null. Retorna info de aging consistente. */
export function calcularAging(
  validadeEm: Date | string | null | undefined,
  now: Date = new Date()
): AgingInfo {
  if (!validadeEm) {
    return { nivel: 'sem-validade', diasRestantes: null, label: 'sem validade', cor: 'fg-3' }
  }
  const validade = typeof validadeEm === 'string' ? new Date(validadeEm) : validadeEm
  if (isNaN(validade.getTime())) {
    return { nivel: 'sem-validade', diasRestantes: null, label: 'sem validade', cor: 'fg-3' }
  }
  // Normaliza ambos para meia-noite — comparação por dias.
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const b = new Date(validade.getFullYear(), validade.getMonth(), validade.getDate()).getTime()
  const dias = Math.round((b - a) / 86_400_000)

  if (dias < 0) {
    return { nivel: 'vencida', diasRestantes: dias, label: `vencida há ${-dias}d`, cor: 'neg' }
  }
  if (dias === 0) {
    return { nivel: 'hoje', diasRestantes: 0, label: 'vence hoje', cor: 'neg' }
  }
  if (dias <= 1) {
    return { nivel: 'urgente', diasRestantes: dias, label: 'vence amanhã', cor: 'warn' }
  }
  if (dias <= 3) {
    return { nivel: 'urgente', diasRestantes: dias, label: `vence em ${dias}d`, cor: 'warn' }
  }
  if (dias <= 7) {
    return { nivel: 'proxima', diasRestantes: dias, label: `${dias}d restantes`, cor: 'info' }
  }
  return { nivel: 'ok', diasRestantes: dias, label: `${dias}d restantes`, cor: 'fg-2' }
}

/** Label legível do canal. */
export const CANAL_LABEL: Record<string, string> = {
  web: 'web',
  whatsapp: 'WhatsApp',
  telefone: 'telefone',
  ia_autonomo: 'IA',
}

/** Ícone (emoji) por canal — visual rápido na lista. */
export const CANAL_ICONE: Record<string, string> = {
  web: '🖥️',
  whatsapp: '💬',
  telefone: '☎️',
  ia_autonomo: '🤖',
}
