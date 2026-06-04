import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROPOSTA_STATUS,
  isAberta,
  isFechadaSucesso,
  isFechadaPerda,
  podeEditar,
  podeEnviar,
  podeDecidirPortal,
  podeMarcarPerdida,
  statusTom,
} from './status'

test('rascunho é aberta e editável', () => {
  assert.ok(isAberta(PROPOSTA_STATUS.RASCUNHO))
  assert.ok(podeEditar(PROPOSTA_STATUS.RASCUNHO))
  assert.ok(podeEnviar(PROPOSTA_STATUS.RASCUNHO))
})

test('enviada é aberta mas não editável', () => {
  assert.ok(isAberta(PROPOSTA_STATUS.ENVIADA))
  assert.ok(!podeEditar(PROPOSTA_STATUS.ENVIADA))
})

test('aceita conta como sucesso', () => {
  assert.ok(isFechadaSucesso(PROPOSTA_STATUS.ACEITA))
  assert.ok(isFechadaSucesso(PROPOSTA_STATUS.APROVADA))
  assert.ok(isFechadaSucesso(PROPOSTA_STATUS.SUCESSO))
})

test('recusada/perdida/expirada contam como perda', () => {
  assert.ok(isFechadaPerda(PROPOSTA_STATUS.RECUSADA))
  assert.ok(isFechadaPerda(PROPOSTA_STATUS.PERDIDA))
  assert.ok(isFechadaPerda(PROPOSTA_STATUS.EXPIRADA))
})

test('cliente pode decidir enviada e em_negociacao', () => {
  assert.ok(podeDecidirPortal(PROPOSTA_STATUS.ENVIADA))
  assert.ok(podeDecidirPortal(PROPOSTA_STATUS.EM_NEGOCIACAO))
  assert.ok(!podeDecidirPortal(PROPOSTA_STATUS.RASCUNHO))
  assert.ok(!podeDecidirPortal(PROPOSTA_STATUS.ACEITA))
})

test('pode marcar perdida em rascunho/enviada/negociacao', () => {
  assert.ok(podeMarcarPerdida(PROPOSTA_STATUS.RASCUNHO))
  assert.ok(podeMarcarPerdida(PROPOSTA_STATUS.ENVIADA))
  assert.ok(podeMarcarPerdida(PROPOSTA_STATUS.EM_NEGOCIACAO))
  assert.ok(!podeMarcarPerdida(PROPOSTA_STATUS.ACEITA))
  assert.ok(!podeMarcarPerdida(PROPOSTA_STATUS.EXPIRADA))
})

test('statusTom retorna cor correta', () => {
  assert.equal(statusTom(PROPOSTA_STATUS.ACEITA), 'pos')
  assert.equal(statusTom(PROPOSTA_STATUS.RECUSADA), 'neg')
  assert.equal(statusTom(PROPOSTA_STATUS.EM_NEGOCIACAO), 'warn')
  assert.equal(statusTom(PROPOSTA_STATUS.ENVIADA), 'info')
  assert.equal(statusTom(PROPOSTA_STATUS.RASCUNHO), 'neutral')
})

test('case-insensitive', () => {
  assert.ok(isAberta('ENVIADA'))
  assert.ok(isFechadaSucesso('Aceita'))
})

test('status desconhecido não classifica em nenhum grupo', () => {
  assert.ok(!isAberta('xyz'))
  assert.ok(!isFechadaSucesso('xyz'))
  assert.ok(!isFechadaPerda('xyz'))
  assert.equal(statusTom('xyz'), 'neutral')
})
