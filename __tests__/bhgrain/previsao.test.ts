import { test } from 'node:test'
import assert from 'node:assert/strict'
import { probabilidade, previsaoReceita, simularMeta } from '../../lib/bhgrain/previsao'

test('probabilidade rascunho = 0', () => {
  assert.equal(probabilidade({ valorTotal: 1000, status: 'rascunho', score: null }), 0)
})

test('probabilidade sucesso = 1', () => {
  assert.equal(probabilidade({ valorTotal: 1000, status: 'sucesso', score: 50 }), 1)
})

test('enviada com score 80 > base 30%', () => {
  const p = probabilidade({ valorTotal: 1000, status: 'enviada', score: 80 })
  assert.ok(p > 0.3 && p <= 0.5, `recebido ${p}`)
})

test('enviada com score 20 < base 30%', () => {
  const p = probabilidade({ valorTotal: 1000, status: 'enviada', score: 20 })
  assert.ok(p < 0.3 && p >= 0.1, `recebido ${p}`)
})

test('previsaoReceita soma ponderada', () => {
  const r = previsaoReceita([
    { valorTotal: 100000, status: 'enviada', score: 50 },
    { valorTotal: 50000, status: 'em_negociacao', score: 70 },
    { valorTotal: 30000, status: 'recusada', score: 50 },
    { valorTotal: 20000, status: 'sucesso', score: 50 },
  ])
  assert.equal(r.total, 200000)
  // enviada(50)=0.3 + neg(70)=~0.7 + recusada=0 + sucesso=1
  // = 100000*0.3 + 50000*0.7 + 0 + 20000*1 = 30000+35000+20000 = 85000
  assert.ok(Math.abs(r.ponderado - 85000) < 100, `ponderado=${r.ponderado}`)
  assert.equal(r.porStatus['sucesso'].count, 1)
})

test('simularMeta: falta e necessario por dia', () => {
  const r = simularMeta({ meta: 2_500_000, atingido: 1_384_500, diasUteisRestantes: 11, previsaoPonderada: 800_000 })
  assert.equal(r.falta, 1_115_500)
  assert.ok(Math.abs(r.necessarioPorDia - 101_409.09) < 1)
  assert.equal(r.cobrePrevisao, false)
})

test('simularMeta: cobrePrevisao quando previsão fecha gap', () => {
  const r = simularMeta({ meta: 1000, atingido: 500, diasUteisRestantes: 10, previsaoPonderada: 600 })
  assert.equal(r.cobrePrevisao, true)
})

test('simularMeta: classificações de risco existem', () => {
  const r = simularMeta({ meta: 1000, atingido: 100, diasUteisRestantes: 1, previsaoPonderada: 0 })
  assert.ok(['critico', 'risco', 'atencao', 'no_ritmo'].includes(r.risco))
})
