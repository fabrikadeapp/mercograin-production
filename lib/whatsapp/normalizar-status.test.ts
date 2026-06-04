import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizarStatusEvolution } from './webhook-handler'

test('SERVER_ACK → sent', () => {
  assert.equal(normalizarStatusEvolution('SERVER_ACK'), 'sent')
})

test('sent → sent', () => {
  assert.equal(normalizarStatusEvolution('sent'), 'sent')
})

test('DELIVERY_ACK → delivered', () => {
  assert.equal(normalizarStatusEvolution('DELIVERY_ACK'), 'delivered')
})

test('delivered → delivered', () => {
  assert.equal(normalizarStatusEvolution('delivered'), 'delivered')
})

test('READ → read', () => {
  assert.equal(normalizarStatusEvolution('READ'), 'read')
})

test('PLAYED → read', () => {
  assert.equal(normalizarStatusEvolution('PLAYED'), 'read')
})

test('FAILED → failed', () => {
  assert.equal(normalizarStatusEvolution('FAILED'), 'failed')
})

test('ERROR → failed', () => {
  assert.equal(normalizarStatusEvolution('ERROR'), 'failed')
})

test('PENDING → sent', () => {
  assert.equal(normalizarStatusEvolution('PENDING'), 'sent')
})

test('status desconhecido → null', () => {
  assert.equal(normalizarStatusEvolution('XYZ'), null)
})

test('string vazia → null', () => {
  assert.equal(normalizarStatusEvolution(''), null)
})
