/**
 * Helpers compartilhados pelos E2E tests (S13+S14 BH Grain).
 *
 * ZERO dependências externas: Node core + bcryptjs + crypto.
 * In-memory store que mimica Prisma minimamente para os fluxos testados.
 */
const crypto = require('crypto')

function uid(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`
}

function makeStore() {
  return {
    workspaces: new Map(),
    users: new Map(),
    clientes: new Map(),
    propostas: new Map(),
    contratos: new Map(),
    propriedades: new Map(),
    talhoes: new Map(),
    lotes: new Map(),
    dds: new Map(),
    kycVerifications: new Map(),
    portalSessions: new Map(),
    aceiteTokens: new Map(),
    hedgePositions: new Map(),
    webhookEvents: [],
    auditLog: [],
  }
}

function audit(store, event, payload = {}) {
  store.auditLog.push({ ts: Date.now(), event, ...payload })
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function hmac(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function signJWT(payload, secret, expSec = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + expSec }
  const h = b64url(JSON.stringify(header))
  const p = b64url(JSON.stringify(body))
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest())
  return `${h}.${p}.${sig}`
}

function verifyJWT(token, secret) {
  const [h, p, s] = token.split('.')
  if (!h || !p || !s) return null
  const expected = b64url(crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest())
  if (s !== expected) return null
  const decoded = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
  if (decoded.exp < Math.floor(Date.now() / 1000)) return null
  return decoded
}

module.exports = { uid, makeStore, audit, sha256, hmac, signJWT, verifyJWT }
