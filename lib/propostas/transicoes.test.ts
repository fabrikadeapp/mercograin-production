import { test } from 'node:test'
import assert from 'node:assert/strict'
import { destinosValidos, validarTransicao } from './transicoes'
import { PROPOSTA_STATUS } from './status'

test('rascunho pode ir para enviada, perdida ou cancelada', () => {
  const v = destinosValidos(PROPOSTA_STATUS.RASCUNHO)
  assert.ok(v.includes(PROPOSTA_STATUS.ENVIADA))
  assert.ok(v.includes(PROPOSTA_STATUS.PERDIDA))
  assert.ok(v.includes(PROPOSTA_STATUS.CANCELADA))
})

test('enviada pode ir para negociacao, aceita, recusada, perdida', () => {
  const v = destinosValidos(PROPOSTA_STATUS.ENVIADA)
  assert.equal(v.length, 4)
  assert.ok(v.includes(PROPOSTA_STATUS.EM_NEGOCIACAO))
  assert.ok(v.includes(PROPOSTA_STATUS.ACEITA))
})

test('status finais não tem transições manuais', () => {
  assert.deepEqual(destinosValidos(PROPOSTA_STATUS.PERDIDA), [])
  assert.deepEqual(destinosValidos(PROPOSTA_STATUS.EXPIRADA), [])
  assert.deepEqual(destinosValidos(PROPOSTA_STATUS.RECUSADA), [])
})

test('validar transição válida rascunho → enviada', () => {
  const r = validarTransicao(PROPOSTA_STATUS.RASCUNHO, PROPOSTA_STATUS.ENVIADA)
  assert.equal(r.ok, true)
})

test('validar transição inválida aceita → rascunho', () => {
  const r = validarTransicao(PROPOSTA_STATUS.ACEITA, PROPOSTA_STATUS.RASCUNHO)
  assert.equal(r.ok, false)
  assert.match(r.motivo!, /não permitida/)
})

test('marcar perdida sem lossReason falha', () => {
  const r = validarTransicao(PROPOSTA_STATUS.ENVIADA, PROPOSTA_STATUS.PERDIDA)
  assert.equal(r.ok, false)
  assert.match(r.motivo!, /lossReason/)
})

test('marcar perdida com lossReason ok', () => {
  const r = validarTransicao(PROPOSTA_STATUS.ENVIADA, PROPOSTA_STATUS.PERDIDA, {
    lossReason: 'preco',
  })
  assert.equal(r.ok, true)
})

test('status atual igual ao destino falha', () => {
  const r = validarTransicao(PROPOSTA_STATUS.ENVIADA, PROPOSTA_STATUS.ENVIADA)
  assert.equal(r.ok, false)
  assert.match(r.motivo!, /atual já é o destino/i)
})

test('case insensitive', () => {
  const r = validarTransicao('RASCUNHO', 'ENVIADA')
  assert.equal(r.ok, true)
})

test('em_negociacao pode voltar para enviada (caso cliente pede tempo)', () => {
  const r = validarTransicao(PROPOSTA_STATUS.EM_NEGOCIACAO, PROPOSTA_STATUS.ENVIADA)
  assert.equal(r.ok, true)
})
