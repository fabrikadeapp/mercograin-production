import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcularScore } from '../../lib/bhgrain/scoring'

const base = {
  clienteRecorrente: false,
  clienteTaxaSucessoHistorica: null,
  ticketMedioCliente: null,
  precoProposta: 100,
  precoMercadoAtual: null,
  margemPercent: null,
  margemMinima: null,
  diasSemContato: null,
  statusProposta: 'enviada',
  validadeCotacaoRestanteMin: null,
}

test('score base ≈ 50 com input neutro', () => {
  const r = calcularScore(base)
  assert.ok(r.score >= 45 && r.score <= 55, `esperado ~50, recebido ${r.score}`)
  assert.equal(r.label, 'media')
})

test('cliente recorrente + histórico positivo aumenta score', () => {
  const r = calcularScore({ ...base, clienteRecorrente: true, clienteTaxaSucessoHistorica: 0.8 })
  assert.ok(r.score > 60, `esperado > 60, recebido ${r.score}`)
  assert.ok(r.fatoresPositivos.length >= 2)
})

test('preço 6% acima do mercado reduz score', () => {
  const r = calcularScore({ ...base, precoProposta: 106, precoMercadoAtual: 100 })
  assert.ok(r.score < 40, `esperado < 40, recebido ${r.score}`)
  assert.ok(r.fatoresNegativos.some((f) => /acima do mercado/i.test(f)))
})

test('cotação vencida derruba score', () => {
  const r = calcularScore({ ...base, validadeCotacaoRestanteMin: 0 })
  assert.ok(r.score <= 40)
  assert.ok(r.fatoresNegativos.some((f) => /vencida/i.test(f)))
})

test('margem abaixo do mínimo penaliza', () => {
  const r = calcularScore({ ...base, margemPercent: 1, margemMinima: 3 })
  assert.ok(r.fatoresNegativos.some((f) => /abaixo do mínimo/i.test(f)))
})

test('status recusada → score máximo 10', () => {
  const r = calcularScore({ ...base, statusProposta: 'recusada' })
  assert.ok(r.score <= 10)
  assert.equal(r.label, 'risco')
})

test('score sempre entre 0 e 100', () => {
  const baixo = calcularScore({
    ...base,
    precoProposta: 200,
    precoMercadoAtual: 100,
    margemPercent: -10,
    margemMinima: 5,
    diasSemContato: 30,
    statusProposta: 'recusada',
    validadeCotacaoRestanteMin: -10,
  })
  assert.ok(baixo.score >= 0 && baixo.score <= 100)

  const alto = calcularScore({
    ...base,
    clienteRecorrente: true,
    clienteTaxaSucessoHistorica: 1,
    precoProposta: 99,
    precoMercadoAtual: 100,
    margemPercent: 15,
    margemMinima: 3,
    diasSemContato: 0,
    statusProposta: 'em_negociacao',
    validadeCotacaoRestanteMin: 60,
  })
  assert.ok(alto.score >= 0 && alto.score <= 100)
  assert.equal(alto.label, 'alta')
})
