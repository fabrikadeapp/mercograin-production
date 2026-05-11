/**
 * E2E: token aceite -> GET /aceite/[token] -> POST aceitar -> Contrato.statusAssinatura.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { uid, makeStore, audit } = require('./_helpers')

const store = makeStore()
const wsId = uid('ws')
store.workspaces.set(wsId, { id: wsId })

const contratoId = uid('cnt')
store.contratos.set(contratoId, {
  id: contratoId, workspaceId: wsId,
  numero: 'CNT-2026-0099', statusAssinatura: 'pendente', clienteId: 'cli1',
})

let token

test('gera token de aceite (24h)', () => {
  token = crypto.randomBytes(24).toString('hex')
  store.aceiteTokens.set(token, {
    contratoId, exp: Date.now() + 24 * 3600 * 1000, consumed: false,
  })
  assert.equal(token.length, 48)
})

test('GET /aceite/[token] retorna contrato (token válido)', () => {
  const rec = store.aceiteTokens.get(token)
  assert.ok(rec && rec.exp > Date.now() && !rec.consumed)
  const c = store.contratos.get(rec.contratoId)
  assert.equal(c.numero, 'CNT-2026-0099')
})

test('POST aceitar consome token + atualiza statusAssinatura + carimbo de tempo', () => {
  const rec = store.aceiteTokens.get(token)
  assert.equal(rec.consumed, false)
  rec.consumed = true
  const c = store.contratos.get(rec.contratoId)
  c.statusAssinatura = 'assinado'
  c.aceitoEm = new Date().toISOString()
  c.aceiteIp = '127.0.0.1'
  c.carimboTempo = Date.now()
  audit(store, 'aceite.digital', { contratoId: c.id })
  assert.equal(c.statusAssinatura, 'assinado')
  assert.ok(c.carimboTempo)
})

test('token já consumido é rejeitado', () => {
  const rec = store.aceiteTokens.get(token)
  assert.equal(rec.consumed, true)
})

test('token expirado é rejeitado', () => {
  const expiredTok = 'expired-' + Math.random()
  store.aceiteTokens.set(expiredTok, { contratoId, exp: Date.now() - 1000, consumed: false })
  const rec = store.aceiteTokens.get(expiredTok)
  assert.ok(rec.exp < Date.now())
})
