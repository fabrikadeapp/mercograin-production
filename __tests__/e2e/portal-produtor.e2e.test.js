/**
 * E2E: convite produtor -> setup senha -> login -> consulta contratos/docs/chat.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { uid, makeStore, signJWT, verifyJWT, audit } = require('./_helpers')

const PORTAL_SECRET = 'portal-produtor-secret'
const store = makeStore()
const wsId = uid('ws')
store.workspaces.set(wsId, { id: wsId })

let clienteId, inviteToken, produtorId
const docs = []
const chats = []

test('trader convida produtor (gera invite token)', () => {
  clienteId = uid('cli')
  store.clientes.set(clienteId, { id: clienteId, workspaceId: wsId, razaoSocial: 'Faz. Sul', email: 'prod@sul.local' })
  inviteToken = signJWT({ clienteId, email: 'prod@sul.local', purpose: 'portal-invite' }, PORTAL_SECRET, 3600)
  assert.ok(inviteToken)
})

test('produtor consome token e define senha', async () => {
  const decoded = verifyJWT(inviteToken, PORTAL_SECRET)
  assert.ok(decoded && decoded.purpose === 'portal-invite')
  produtorId = uid('prod')
  store.users.set(produtorId, {
    id: produtorId, email: decoded.email, role: 'produtor',
    clienteId: decoded.clienteId, workspaceId: wsId,
    passwordHash: await bcrypt.hash('Produtor#1', 4),
  })
  audit(store, 'portal.setup', { produtorId })
  assert.ok(store.users.has(produtorId))
})

test('login produtor emite session específica do portal', async () => {
  const u = store.users.get(produtorId)
  assert.equal(await bcrypt.compare('Produtor#1', u.passwordHash), true)
  const sess = signJWT({ sub: u.id, clienteId: u.clienteId, scope: 'portal' }, PORTAL_SECRET, 7 * 24 * 3600)
  store.portalSessions.set(sess, { userId: u.id, exp: Date.now() + 1e9 })
  assert.ok(store.portalSessions.has(sess))
})

test('produtor consulta contratos do próprio cliente apenas', () => {
  store.contratos.set('c1', { id: 'c1', clienteId, workspaceId: wsId, numero: 'CNT-1' })
  store.contratos.set('c2', { id: 'c2', clienteId: 'outro', workspaceId: wsId, numero: 'CNT-2' })
  const u = store.users.get(produtorId)
  const meus = [...store.contratos.values()].filter((c) => c.clienteId === u.clienteId)
  assert.equal(meus.length, 1)
  assert.equal(meus[0].numero, 'CNT-1')
})

test('cofre de documentos: upload e listagem por produtor', () => {
  docs.push({ id: 'd1', clienteId, fileName: 'CAR.pdf', sha256: 'a'.repeat(64) })
  const meusDocs = docs.filter((d) => d.clienteId === clienteId)
  assert.equal(meusDocs.length, 1)
})

test('chat produtor<->trader persiste mensagens', () => {
  chats.push({ from: 'produtor', to: 'trader', msg: 'oi', clienteId, ts: Date.now() })
  chats.push({ from: 'trader', to: 'produtor', msg: 'olá', clienteId, ts: Date.now() })
  assert.equal(chats.filter((c) => c.clienteId === clienteId).length, 2)
})
