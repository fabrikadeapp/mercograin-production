import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  gerarTokenAssinatura,
  validarTokenAssinatura,
  hashTokenAssinatura,
} from './native-token'

test('gera e valida token corretamente', () => {
  const { token, tokenHash, expiraEm } = gerarTokenAssinatura('assin-1', 0)
  assert.ok(token.length > 50)
  assert.equal(tokenHash.length, 64) // SHA-256 hex
  assert.ok(expiraEm.getTime() > Date.now())

  const v = validarTokenAssinatura(token)
  assert.equal(v.valid, true)
  assert.equal(v.expirado, false)
  assert.equal(v.assinaturaId, 'assin-1')
  assert.equal(v.signatorioIdx, 0)
  assert.equal(v.tokenHash, tokenHash)
})

test('token com signatorioIdx > 0', () => {
  const { token } = gerarTokenAssinatura('assin-2', 3)
  const v = validarTokenAssinatura(token)
  assert.equal(v.signatorioIdx, 3)
})

test('token corrompido falha', () => {
  const { token } = gerarTokenAssinatura('assin-3', 0)
  const v = validarTokenAssinatura(token + 'X')
  assert.equal(v.valid, false)
})

test('token vazio falha', () => {
  const v = validarTokenAssinatura('')
  assert.equal(v.valid, false)
})

test('token mal formado falha', () => {
  const v = validarTokenAssinatura('abc.def')
  assert.equal(v.valid, false)
})

test('TTL personalizado', () => {
  const { expiraEm } = gerarTokenAssinatura('assin-4', 0, { ttlDays: 7 })
  const esperado = Date.now() + 7 * 86_400_000
  assert.ok(Math.abs(expiraEm.getTime() - esperado) < 5000)
})

test('expiraEm explicito tem precedencia', () => {
  const data = new Date('2027-01-01')
  const { expiraEm } = gerarTokenAssinatura('assin-5', 0, { expiraEm: data })
  assert.equal(expiraEm.getTime(), data.getTime())
})

test('hashTokenAssinatura é determinístico', () => {
  const { token } = gerarTokenAssinatura('assin-6', 0)
  assert.equal(hashTokenAssinatura(token), hashTokenAssinatura(token))
})

test('tokens diferentes para mesmo signatário (nonce muda)', () => {
  const t1 = gerarTokenAssinatura('assin-7', 0)
  const t2 = gerarTokenAssinatura('assin-7', 0)
  assert.notEqual(t1.token, t2.token)
  assert.notEqual(t1.tokenHash, t2.tokenHash)
})

test('token expirado retorna valid=false e expirado=true', () => {
  const ontem = new Date(Date.now() - 86_400_000)
  const { token } = gerarTokenAssinatura('assin-8', 0, { expiraEm: ontem })
  const v = validarTokenAssinatura(token)
  assert.equal(v.valid, false)
  assert.equal(v.expirado, true)
})
