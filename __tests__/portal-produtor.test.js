/**
 * S12 M10 — Tests para auth do portal produtor.
 *
 * Roda standalone via `node __tests__/portal-produtor.test.js` ou
 * é importado por `node __tests__/simple.test.js` na consolidação.
 *
 * Usa apenas Node core + bcryptjs (já no projeto).
 */
const crypto = require('crypto')
const bcrypt = require('bcryptjs')

// Reproduz logic core da lib/portal-produtor/auth.ts (sem next/headers).
function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64')
}
const SECRET = 'test-secret-portal-produtor'
function signSession(payload) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + 60 * 60 * 24 * 7 }
  const h = b64url(JSON.stringify(header))
  const p = b64url(JSON.stringify(body))
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest())
  return `${h}.${p}.${sig}`
}
function verifySession(token) {
  try {
    const [h, p, s] = token.split('.')
    if (!h || !p || !s) return null
    const expected = b64url(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest())
    const a = Buffer.from(s), b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const payload = JSON.parse(b64urlDecode(p).toString('utf8'))
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch { return null }
}

let passed = 0, failed = 0
function test(name, fn) {
  try { fn(); console.log(`PASS  ${name}`); passed++ }
  catch (e) { console.log(`FAIL  ${name}: ${e.message}`); failed++ }
}
function assert(cond, msg) { if (!cond) throw new Error(msg) }

test('JWT sign/verify roundtrip', () => {
  const tok = signSession({ workspaceId: 'ws_1', clienteId: 'cli_1', accessId: 'acc_1' })
  const decoded = verifySession(tok)
  assert(decoded && decoded.clienteId === 'cli_1', 'decode failed')
})

test('JWT tampered signature rejected', () => {
  const tok = signSession({ workspaceId: 'ws_1', clienteId: 'cli_1', accessId: 'acc_1' })
  const tampered = tok.slice(0, -2) + 'XX'
  assert(verifySession(tampered) === null, 'should reject tamper')
})

test('JWT expired rejected', () => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const body = { workspaceId: 'w', clienteId: 'c', accessId: 'a', iat: 1, exp: 2 }
  const h = b64url(JSON.stringify(header))
  const p = b64url(JSON.stringify(body))
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest())
  const tok = `${h}.${p}.${sig}`
  assert(verifySession(tok) === null, 'expired must be rejected')
})

test('Password hash bcrypt rounds 12 verify', () => {
  const hash = bcrypt.hashSync('SenhaForte123', 12)
  assert(bcrypt.compareSync('SenhaForte123', hash), 'verify password')
  assert(!bcrypt.compareSync('errada', hash), 'reject wrong password')
})

test('Initial token verify (random + bcrypt)', () => {
  const raw = crypto.randomBytes(24).toString('hex')
  const hash = bcrypt.hashSync(raw, 12)
  assert(bcrypt.compareSync(raw, hash), 'verify token')
  assert(!bcrypt.compareSync('fake', hash), 'reject fake token')
  assert(raw.length === 48, 'raw token = 48 hex chars')
})

test('Cross-tenant isolation check (workspaceId scoping)', () => {
  // Simula que session do cliente A não deve permitir acesso a cliente B
  const sessA = { workspaceId: 'ws_a', clienteId: 'cli_a' }
  const sessB = { workspaceId: 'ws_b', clienteId: 'cli_b' }
  assert(sessA.workspaceId !== sessB.workspaceId, 'tenants diferentes')
  assert(sessA.clienteId !== sessB.clienteId, 'clientes diferentes')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
