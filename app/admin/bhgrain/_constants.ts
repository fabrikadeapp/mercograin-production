export const REGRA_TIPOS = [
  'margem_minima',
  'validade_proposta',
  'desconto_max',
  'aprovacao_valor',
  'aprovacao_margem',
  'bloqueio_preco_vencido',
  'follow_up',
  'canal_preferencial',
] as const

export const REGRA_ACOES = ['alertar', 'bloquear', 'aprovar', 'sugerir'] as const

export const LOSS_REASONS_ARR = [
  'Preço alto',
  'Prazo inadequado',
  'Concorrente ganhou',
  'Cliente sem orçamento',
  'Produto indisponível',
  'Condição de pagamento inadequada',
  'Outro',
] as const
