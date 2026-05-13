import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sugerirFollowUp } from '../../lib/bhgrain/follow-up'
import { priorizarDia } from '../../lib/bhgrain/priorizacao'

test('follow-up: dados incompletos pedem confirmação', () => {
  const r = sugerirFollowUp({
    clienteNome: 'João Silva',
    commodity: 'Soja',
    horasDesdeEnvio: 0,
    status: 'pendente',
    validadeCotacaoRestanteMin: null,
    precisaConfirmar: 'pagamento',
  })
  assert.equal(r.precisa, true)
  assert.match(r.mensagem, /João/)
  assert.match(r.mensagem, /condição de pagamento/)
})

test('follow-up: cotação vencendo gera urgência', () => {
  const r = sugerirFollowUp({
    clienteNome: 'Cooperativa SP',
    commodity: 'Milho',
    horasDesdeEnvio: 1,
    status: 'enviada',
    validadeCotacaoRestanteMin: 10,
  })
  assert.equal(r.precisa, true)
  assert.equal(r.prazoSugerido, '2h')
  assert.match(r.motivo, /vence em/)
})

test('follow-up: sem resposta >24h → manhã seguinte', () => {
  const r = sugerirFollowUp({
    clienteNome: 'Granjária',
    commodity: 'Trigo',
    horasDesdeEnvio: 30,
    status: 'enviada',
    validadeCotacaoRestanteMin: 1000,
  })
  assert.equal(r.precisa, true)
  assert.equal(r.prazoSugerido, 'amanha')
})

test('follow-up: dentro do prazo razoável → não precisa', () => {
  const r = sugerirFollowUp({
    clienteNome: 'Fazenda',
    commodity: 'Soja',
    horasDesdeEnvio: 1,
    status: 'enviada',
    validadeCotacaoRestanteMin: 60,
  })
  assert.equal(r.precisa, false)
})

test('priorizar: cotação vencida tem prioridade máxima', () => {
  const r = priorizarDia([
    {
      id: 'a', clienteNome: 'X', commodity: 'Soja', valorTotal: 10000, status: 'enviada',
      score: 90, margemPercent: 10, margemMinima: 3, validadeCotacaoRestanteMin: -5, horasSemResposta: 2,
    },
    {
      id: 'b', clienteNome: 'Y', commodity: 'Milho', valorTotal: 50000, status: 'rascunho_ia',
      score: 80, margemPercent: 5, margemMinima: 3, validadeCotacaoRestanteMin: 60, horasSemResposta: null,
    },
  ])
  assert.equal(r[0].propostaId, 'a')
  assert.equal(r[0].tipo, 'cotacao_vencida')
})

test('priorizar: alto score em rascunho → enviar', () => {
  const r = priorizarDia([
    {
      id: 'a', clienteNome: 'X', commodity: 'Soja', valorTotal: 100000, status: 'rascunho_ia',
      score: 85, margemPercent: 10, margemMinima: 3, validadeCotacaoRestanteMin: 120, horasSemResposta: null,
    },
  ])
  assert.equal(r[0].tipo, 'alto_score_sem_envio')
  assert.equal(r[0].prioridade, 'alta')
})

test('priorizar: limit respeitado', () => {
  const base = (id: string) => ({
    id, clienteNome: id, commodity: 'Soja', valorTotal: 60000, status: 'enviada' as const,
    score: 70, margemPercent: 5, margemMinima: 3, validadeCotacaoRestanteMin: 60, horasSemResposta: 30,
  })
  const r = priorizarDia([base('a'), base('b'), base('c'), base('d'), base('e'), base('f'), base('g')], 3)
  assert.equal(r.length, 3)
})

test('priorizar: lista vazia retorna vazio', () => {
  assert.deepEqual(priorizarDia([]), [])
})
