/**
 * BH Grain — Follow-up assistido (funções puras).
 *
 * Gera sugestões de mensagem. NÃO envia. Usuário tem que aprovar.
 */

export interface FollowUpInput {
  clienteNome: string
  commodity: string
  horasDesdeEnvio: number
  status: string
  validadeCotacaoRestanteMin: number | null
  precisaConfirmar?: 'prazo' | 'pagamento' | 'volume' | null
}

export interface FollowUpSugestao {
  precisa: boolean
  motivo: string
  mensagem: string
  prazoSugerido: '2h' | '4h' | '24h' | 'amanha'
}

const PRIMEIRO_NOME = (n: string) => n.split(' ')[0] || n

export function sugerirFollowUp(input: FollowUpInput): FollowUpSugestao {
  const primeiro = PRIMEIRO_NOME(input.clienteNome)

  if (input.precisaConfirmar) {
    const campos: Record<string, string> = {
      prazo: 'prazo de entrega',
      pagamento: 'condição de pagamento',
      volume: 'volume desejado',
    }
    return {
      precisa: true,
      motivo: `Dados incompletos: faltam confirmar ${campos[input.precisaConfirmar]}`,
      mensagem: `Olá, ${primeiro}. Para fechar a proposta de ${input.commodity}, conseguimos confirmar o ${campos[input.precisaConfirmar]}?`,
      prazoSugerido: '2h',
    }
  }

  if (input.validadeCotacaoRestanteMin != null && input.validadeCotacaoRestanteMin <= 15 && input.validadeCotacaoRestanteMin > 0) {
    return {
      precisa: true,
      motivo: `Cotação vence em ${input.validadeCotacaoRestanteMin} min`,
      mensagem: `Olá, ${primeiro}. Só lembrando que a cotação de ${input.commodity} é válida por mais ${input.validadeCotacaoRestanteMin} minutos. Posso travar o preço?`,
      prazoSugerido: '2h',
    }
  }

  const horas = input.horasDesdeEnvio
  const statusLow = input.status.toLowerCase()
  const esperando = statusLow === 'enviada' || /negocia/.test(statusLow)

  if (esperando && horas >= 24) {
    return {
      precisa: true,
      motivo: `Sem resposta há ${Math.round(horas)}h`,
      mensagem: `Olá, ${primeiro}. Conseguiu avaliar a proposta de ${input.commodity}? Posso ajustar prazo ou volume se necessário.`,
      prazoSugerido: 'amanha',
    }
  }
  if (esperando && horas >= 4) {
    return {
      precisa: true,
      motivo: `Sem resposta há ${Math.round(horas)}h`,
      mensagem: `Olá, ${primeiro}. Passando aqui só para saber se conseguiu olhar a proposta de ${input.commodity}.`,
      prazoSugerido: '4h',
    }
  }

  return {
    precisa: false,
    motivo: 'Aguardando — ainda dentro do prazo razoável',
    mensagem: '',
    prazoSugerido: '24h',
  }
}
