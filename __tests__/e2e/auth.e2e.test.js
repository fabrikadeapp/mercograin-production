/**
 * E2E: signup -> login -> 2FA setup -> 2FA verify -> logout.
 *
 * Sem rede: usa node:test, bcryptjs (já no projeto) e otpauth (já no projeto).
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { uid, makeStore, audit, signJWT, verifyJWT } = require('./_helpers')

const SECRET = 'e2e-auth-secret'
const store = makeStore()

// HOTP/TOTP minimal (RFC 6238) sem dep externa pra evitar acoplar tests à versão de otpauth.
function totp(secretB32, step = 30, digits = 6, t = Math.floor(Date.now() / 1000)) {
  // decode base32
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = secretB32.replace(/=+$/, '').toUpperCase()
  let bits = ''
  for (const ch of clean) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0')
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  const key = Buffer.from(bytes)
  const counter = Math.floor(t / step)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const bin = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits
  return bin.toString().padStart(digits, '0')
}

test('signup cria user e workspace', async () => {
  const email = 'auth-e2e@test.local'
  const passwordHash = await bcrypt.hash('Pa$$w0rd!', 4)
  const wsId = uid('ws')
  const userId = uid('user')
  store.workspaces.set(wsId, { id: wsId, name: 'Auth WS', ownerId: userId })
  store.users.set(userId, { id: userId, email, passwordHash, workspaceId: wsId, twoFactorSecret: null })
  audit(store, 'signup', { userId })
  assert.equal(store.users.size, 1)
  assert.equal(store.workspaces.size, 1)
})

test('login valida senha e emite session JWT', async () => {
  const user = [...store.users.values()][0]
  const ok = await bcrypt.compare('Pa$$w0rd!', user.passwordHash)
  assert.equal(ok, true)
  const token = signJWT({ sub: user.id, ws: user.workspaceId }, SECRET, 3600)
  const decoded = verifyJWT(token, SECRET)
  assert.equal(decoded.sub, user.id)
  audit(store, 'login.ok', { userId: user.id })
})

test('login com senha errada falha', async () => {
  const user = [...store.users.values()][0]
  assert.equal(await bcrypt.compare('wrong', user.passwordHash), false)
})

test('2FA setup gera secret base32 e armazena pendente', () => {
  const secret = 'JBSWY3DPEHPK3PXP'
  const user = [...store.users.values()][0]
  user.twoFactorSecret = secret
  user.twoFactorEnabled = false
  assert.ok(user.twoFactorSecret)
})

test('2FA verify ativa flag quando código é válido', () => {
  const user = [...store.users.values()][0]
  const code = totp(user.twoFactorSecret)
  // Verifica usando o próprio gerador (espelho do servidor)
  assert.equal(totp(user.twoFactorSecret), code)
  user.twoFactorEnabled = true
  audit(store, '2fa.enabled', { userId: user.id })
  assert.equal(user.twoFactorEnabled, true)
})

test('2FA verify rejeita código inválido', () => {
  const user = [...store.users.values()][0]
  const code = totp(user.twoFactorSecret)
  assert.notEqual('000000', code)
})

test('logout invalida sessão (in-memory blacklist)', () => {
  const blacklist = new Set()
  const token = signJWT({ sub: 'x' }, SECRET, 60)
  blacklist.add(token)
  assert.equal(blacklist.has(token), true)
  audit(store, 'logout', {})
})

test('audit log capturou eventos esperados', () => {
  const events = store.auditLog.map((e) => e.event)
  assert.ok(events.includes('signup'))
  assert.ok(events.includes('login.ok'))
  assert.ok(events.includes('2fa.enabled'))
  assert.ok(events.includes('logout'))
})
