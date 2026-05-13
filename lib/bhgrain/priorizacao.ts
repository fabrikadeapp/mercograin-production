/**
 * BH Grain — Priorização diária ("O que fazer agora", função pura).
 *
 * Recebe lista de propostas + dados de contexto e devolve top-N ações
 * ordenadas por importância.
 */

export interface PropostaContexto {
  id: string
  clienteNome: string
  commodity: string
  valorTotal: number
  status: string
  score: number | null
  margemPercent: number | null
  margemMinima: number | null
  validadeCotacaoRestanteMin: number | null
  horasSemResposta: number | null
}

export type PrioridadeTipo =
  | 'cotacao_vencendo'
  | 'cotacao_vencida'
  | 'margem_baixa'
  | 'alto_valor_sem_resposta'
  | 'alto_score_sem_envio'
  | 'follow_up'

export interface PrioridadeItem {
  propostaId: string
  tipo: PrioridadeTipo
  prioridade: 'alta' | 'media' | 'baixa'
  titulo: string
  motivo: string
  acaoSugerida: string
}

export function priorizarDia(propostas: PropostaContexto[], limit = 5): PrioridadeItem[] {
  const items: Array<PrioridadeItem & { _score: number }> = []

  for (const p of propostas) {
    const statusLow = p.status.toLowerCase()

    // Cotação vencida — prioridade absoluta (offset alto para sempre liderar)
    if (p.validadeCotacaoRestanteMin != null && p.validadeCotacaoRestanteMin <= 0) {
      items.push({
        propostaId: p.id,
        tipo: 'cotacao_vencida',
        prioridade: 'alta',
        titulo: `Atualizar cotação — ${p.clienteNome}`,
        motivo: `Proposta de ${p.commodity} usa preço vencido`,
        acaoSugerida: 'Atualizar preço antes de enviar/manter',
        _score: 10000 + p.valorTotal / 1000,
      })
      continue
    }

    // Cotação vence em <=15min
    if (p.validadeCotacaoRestanteMin != null && p.validadeCotacaoRestanteMin <= 15 && p.validadeCotacaoRestanteMin > 0) {
      items.push({
        propostaId: p.id,
        tipo: 'cotacao_vencendo',
        prioridade: 'alta',
        titulo: `Travar preço — ${p.clienteNome}`,
        motivo: `Cotação de ${p.commodity} vence em ${p.validadeCotacaoRestanteMin} min`,
        acaoSugerida: 'Confirmar com cliente e travar preço',
        _score: 900 + p.valorTotal / 1000,
      })
      continue
    }

    // Margem abaixo do mínimo
    if (p.margemPercent != null && p.margemMinima != null && p.margemPercent < p.margemMinima) {
      items.push({
        propostaId: p.id,
        tipo: 'margem_baixa',
        prioridade: 'media',
        titulo: `Revisar preço — ${p.clienteNome}`,
        motivo: `Margem ${p.margemPercent.toFixed(2)}% < mínima ${p.margemMinima.toFixed(2)}%`,
        acaoSugerida: 'Aumentar preço ou solicitar aprovação',
        _score: 600 + p.valorTotal / 5000,
      })
      continue
    }

    // Alto score + ainda em rascunho/pronta → enviar
    if ((statusLow.startsWith('rascunho') || statusLow === 'pronta_para_enviar' || statusLow === 'pronta para enviar') && p.score != null && p.score >= 70) {
      items.push({
        propostaId: p.id,
        tipo: 'alto_score_sem_envio',
        prioridade: 'alta',
        titulo: `Revisar e enviar — ${p.clienteNome}`,
        motivo: `Score ${p.score}% · proposta de ${p.commodity} pronta`,
        acaoSugerida: 'Revisar e enviar',
        _score: 800 + (p.score - 50) * 10 + p.valorTotal / 1000,
      })
      continue
    }

    // Alto valor + sem resposta há >24h
    if (p.horasSemResposta != null && p.horasSemResposta >= 24 && p.valorTotal >= 50000) {
      items.push({
        propostaId: p.id,
        tipo: 'alto_valor_sem_resposta',
        prioridade: 'media',
        titulo: `Follow-up — ${p.clienteNome}`,
        motivo: `R$ ${Math.round(p.valorTotal).toLocaleString('pt-BR')} sem resposta há ${Math.round(p.horasSemResposta)}h`,
        acaoSugerida: 'Enviar follow-up',
        _score: 500 + p.valorTotal / 1000,
      })
      continue
    }

    // Follow-up genérico
    if (p.horasSemResposta != null && p.horasSemResposta >= 4 && p.horasSemResposta < 24 && (statusLow === 'enviada' || /negocia/.test(statusLow))) {
      items.push({
        propostaId: p.id,
        tipo: 'follow_up',
        prioridade: 'baixa',
        titulo: `Follow-up — ${p.clienteNome}`,
        motivo: `Sem resposta há ${Math.round(p.horasSemResposta)}h`,
        acaoSugerida: 'Enviar follow-up curto',
        _score: 200 + p.valorTotal / 5000,
      })
    }
  }

  items.sort((a, b) => b._score - a._score)
  return items.slice(0, limit).map(({ _score, ...rest }) => rest)
}
