import { test } from 'node:test'
import assert from 'node:assert/strict'
import { proximaAcao } from '../../lib/bhgrain/proxima-acao'

const base = {
  status: 'enviada',
  margemPercent: 5,
  margemMinima: 3,
  validadeCotacaoRestanteMin: 30,
  horasSemResposta: 1,
  precisaAprovacao: false,
  dadosCompletos: true,
}

test('dados incompletos → solicitar_info', () => {
  const r = proximaAcao({ ...base, dadosCompletos: false })
  assert.equal(r.acao, 'solicitar_info')
})

test('cotação vencida → atualizar_cotacao', () => {
  const r = proximaAcao({ ...base, validadeCotacaoRestanteMin: 0 })
  assert.equal(r.acao, 'atualizar_cotacao')
})

test('margem abaixo do mínimo → revisar_preco', () => {
  const r = proximaAcao({ ...base, margemPercent: 1, margemMinima: 3 })
  assert.equal(r.acao, 'revisar_preco')
})

test('precisa aprovação → aprovacao', () => {
  const r = proximaAcao({ ...base, precisaAprovacao: true })
  assert.equal(r.acao, 'aprovacao')
})

test('rascunho com dados ok → enviar_proposta', () => {
  const r = proximaAcao({ ...base, status: 'rascunho_ia' })
  assert.equal(r.acao, 'enviar_proposta')
})

test('enviada sem resposta há 6h → follow_up', () => {
  const r = proximaAcao({ ...base, horasSemResposta: 6 })
  assert.equal(r.acao, 'follow_up')
})

test('enviada com resposta recente → aguardar', () => {
  const r = proximaAcao({ ...base, horasSemResposta: 1 })
  assert.equal(r.acao, 'aguardar')
})

test('precedência: cotação vencida vence margem baixa', () => {
  const r = proximaAcao({ ...base, validadeCotacaoRestanteMin: 0, margemPercent: 1, margemMinima: 3 })
  assert.equal(r.acao, 'atualizar_cotacao')
})
