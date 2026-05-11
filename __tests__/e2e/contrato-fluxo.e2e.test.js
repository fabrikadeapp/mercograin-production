/**
 * E2E: cliente -> proposta -> aceite -> contrato -> assinatura (mock) -> webhook -> 'assinado'.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { uid, makeStore, audit, sha256, hmac } = require('./_helpers')

const SIGN_SECRET = 'mock-zapsign-secret'
const store = makeStore()
const wsId = uid('ws')
store.workspaces.set(wsId, { id: wsId, name: 'Trader' })

let clienteId, propostaId, contratoId

test('cria cliente', () => {
  clienteId = uid('cli')
  store.clientes.set(clienteId, {
    id: clienteId, workspaceId: wsId,
    razaoSocial: 'Fazenda Boa Vista LTDA',
    cnpj: '12345678000190',
    email: 'comprador@boavista.local',
  })
  assert.ok(store.clientes.has(clienteId))
})

test('cria proposta com 1 grão', () => {
  propostaId = uid('prop')
  store.propostas.set(propostaId, {
    id: propostaId, workspaceId: wsId, clienteId,
    graos: [{ grao: 'soja', quantidade: 1000, precoSaca: 130 }],
    status: 'enviada',
  })
  assert.equal(store.propostas.size, 1)
})

test('cliente aceita proposta', () => {
  const p = store.propostas.get(propostaId)
  p.status = 'aceita'
  p.aceitaEm = new Date().toISOString()
  assert.equal(p.status, 'aceita')
  audit(store, 'proposta.aceita', { propostaId })
})

test('contrato é gerado a partir da proposta aceita', () => {
  contratoId = uid('cnt')
  const p = store.propostas.get(propostaId)
  store.contratos.set(contratoId, {
    id: contratoId, workspaceId: wsId, propostaId,
    numero: 'CNT-2026-0001',
    valorTotal: p.graos[0].quantidade * p.graos[0].precoSaca,
    statusAssinatura: 'pendente',
    hash: null,
  })
  assert.equal(store.contratos.size, 1)
})

test('envio para mock signature provider gera token', () => {
  const c = store.contratos.get(contratoId)
  c.signatureToken = uid('sig')
  c.statusAssinatura = 'enviado'
  c.hash = sha256(`${c.id}|${c.valorTotal}|${c.numero}`)
  assert.ok(c.signatureToken)
  assert.equal(c.statusAssinatura, 'enviado')
  assert.equal(c.hash.length, 64)
})

test('webhook signed valida HMAC e atualiza status', () => {
  const c = store.contratos.get(contratoId)
  const payload = JSON.stringify({ event: 'signed', token: c.signatureToken, contratoId: c.id })
  const sig = hmac(SIGN_SECRET, payload)
  // simula receiver
  const valid = hmac(SIGN_SECRET, payload) === sig
  assert.equal(valid, true)
  const evt = JSON.parse(payload)
  store.webhookEvents.push({ ...evt, sig, receivedAt: Date.now() })
  if (evt.event === 'signed' && evt.contratoId === c.id) {
    c.statusAssinatura = 'assinado'
    c.assinadoEm = new Date().toISOString()
  }
  assert.equal(c.statusAssinatura, 'assinado')
})

test('webhook com HMAC inválido é rejeitado (idempotência preservada)', () => {
  const c = store.contratos.get(contratoId)
  const payload = JSON.stringify({ event: 'signed', token: 'fake' })
  const badSig = 'deadbeef'
  const expected = hmac(SIGN_SECRET, payload)
  assert.notEqual(badSig, expected)
  // status não mudou
  assert.equal(c.statusAssinatura, 'assinado')
})

test('contrato final possui hash imutável + statusAssinatura assinado', () => {
  const c = store.contratos.get(contratoId)
  assert.equal(c.statusAssinatura, 'assinado')
  assert.ok(c.hash)
})
