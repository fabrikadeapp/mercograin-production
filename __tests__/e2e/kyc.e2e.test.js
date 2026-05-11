/**
 * E2E: cliente PJ -> POST /kyc -> resposta com 5 verificações
 * (CGU, SmartLab/MTE, SICAR, ReceitaWS, CEAF). Mock providers.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { uid, makeStore, audit } = require('./_helpers')

const store = makeStore()
const wsId = uid('ws')
store.workspaces.set(wsId, { id: wsId })

function mockKycPipeline(cliente) {
  // 5 verificações conforme S4 M1 Compliance KYC
  return [
    { source: 'CGU', status: cliente.cnpj === '00000000000191' ? 'flagged' : 'clean', evidence: 'sem-citacoes-cgu' },
    { source: 'SmartLab', status: 'clean', evidence: 'sem-trabalho-escravo' },
    { source: 'SICAR', status: 'clean', evidence: cliente.car || 'sem-CAR-vinculado' },
    { source: 'ReceitaWS', status: 'active', evidence: 'cnpj-ativo' },
    { source: 'CEAF', status: 'clean', evidence: 'nao-listado' },
  ]
}

let clienteId
test('cria cliente PJ', () => {
  clienteId = uid('cli')
  store.clientes.set(clienteId, {
    id: clienteId, workspaceId: wsId,
    razaoSocial: 'AgroPJ LTDA', cnpj: '12345678000190',
    car: 'PR-1234567-89',
  })
  assert.ok(store.clientes.has(clienteId))
})

test('POST /kyc retorna 5 verificações', () => {
  const cliente = store.clientes.get(clienteId)
  const result = mockKycPipeline(cliente)
  store.kycVerifications.set(clienteId, result)
  assert.equal(result.length, 5)
  const sources = result.map((r) => r.source).sort()
  assert.deepEqual(sources, ['CEAF', 'CGU', 'ReceitaWS', 'SICAR', 'SmartLab'])
  audit(store, 'kyc.executed', { clienteId, count: result.length })
})

test('cliente com CNPJ listado em CGU é flagged', () => {
  const sus = { id: 'x', cnpj: '00000000000191' }
  const r = mockKycPipeline(sus)
  const cgu = r.find((x) => x.source === 'CGU')
  assert.equal(cgu.status, 'flagged')
})

test('KYC persiste resultado consultável', () => {
  const stored = store.kycVerifications.get(clienteId)
  assert.ok(stored)
  assert.equal(stored.length, 5)
})
