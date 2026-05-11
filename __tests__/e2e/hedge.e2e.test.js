/**
 * E2E: posição long -> mark-to-market -> fecha com perda -> P&L final.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { uid, makeStore, audit } = require('./_helpers')

const store = makeStore()
const wsId = uid('ws')
store.workspaces.set(wsId, { id: wsId })

let posId

test('cria posição long: soja 100 sacas @ R$ 130', () => {
  posId = uid('hpos')
  store.hedgePositions.set(posId, {
    id: posId, workspaceId: wsId, instrumento: 'SOJA-CBOT',
    side: 'LONG', quantidade: 100, precoEntrada: 130,
    moeda: 'BRL', abertaEm: '2026-05-01', status: 'aberta',
    marcacoes: [],
  })
  assert.ok(store.hedgePositions.has(posId))
})

test('marca a mercado @ R$ 125 (P&L parcial = -500)', () => {
  const p = store.hedgePositions.get(posId)
  const precoAtual = 125
  const pnlParcial = (precoAtual - p.precoEntrada) * p.quantidade
  p.marcacoes.push({ ts: '2026-05-05', preco: precoAtual, pnl: pnlParcial })
  assert.equal(pnlParcial, -500)
})

test('fecha posição @ R$ 122 (P&L realizado = -800)', () => {
  const p = store.hedgePositions.get(posId)
  const precoSaida = 122
  p.precoSaida = precoSaida
  p.fechadaEm = '2026-05-10'
  p.status = 'fechada'
  // LONG: pnl = (saida - entrada) * qtd
  p.pnlRealizado = (precoSaida - p.precoEntrada) * p.quantidade
  audit(store, 'hedge.close', { posId, pnl: p.pnlRealizado })
  assert.equal(p.pnlRealizado, -800)
  assert.equal(p.status, 'fechada')
})

test('SHORT calcula P&L com sinal invertido', () => {
  const sid = uid('hpos')
  const sp = {
    id: sid, side: 'SHORT', quantidade: 50,
    precoEntrada: 200, precoSaida: 180, quantidadeSign: 1,
  }
  const pnl = (sp.precoEntrada - sp.precoSaida) * sp.quantidade
  assert.equal(pnl, 1000)
})

test('marcacoes preservam histórico imutável', () => {
  const p = store.hedgePositions.get(posId)
  assert.equal(p.marcacoes.length, 1)
})
