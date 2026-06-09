import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveMargem, calcularPreco } from '../../lib/precificacao/margem'

test('cascata: margem do cliente sobrepõe global', () => {
  const r = resolveMargem({
    grao: 'soja', tipo: 'venda',
    margensCliente: [{ grao: 'soja', tipo: 'venda', pct: 1.2 }],
    margensGlobais: [{ commodity: 'soja', margemPercent: 2 }],
  })
  assert.equal(r.pct, 1.2)
  assert.equal(r.fonte, 'cliente')
})

test('cascata: usa global quando não há margem de cliente', () => {
  const r = resolveMargem({ grao: 'soja', tipo: 'venda', margensGlobais: [{ commodity: 'soja', margemPercent: 2 }] })
  assert.equal(r.pct, 2)
  assert.equal(r.fonte, 'global')
})

test('cascata: default quando nada configurado', () => {
  const r = resolveMargem({ grao: 'milho', tipo: 'compra', defaultPct: 1 })
  assert.equal(r.pct, 1)
  assert.equal(r.fonte, 'default')
})

test('margem de cliente respeita o tipo (compra vs venda)', () => {
  const margens = [{ grao: 'soja', tipo: 'venda', pct: 1.2 }, { grao: 'soja', tipo: 'compra', pct: 0.8 }]
  assert.equal(resolveMargem({ grao: 'soja', tipo: 'venda', margensCliente: margens }).pct, 1.2)
  assert.equal(resolveMargem({ grao: 'soja', tipo: 'compra', margensCliente: margens }).pct, 0.8)
})

test('margem inativa é ignorada', () => {
  const r = resolveMargem({
    grao: 'soja', tipo: 'venda',
    margensCliente: [{ grao: 'soja', tipo: 'venda', pct: 1.2, ativo: false }],
    margensGlobais: [{ commodity: 'soja', margemPercent: 2 }],
  })
  assert.equal(r.fonte, 'global')
})

test('preço de venda acresce margem; compra desconta', () => {
  assert.equal(calcularPreco(100, 2, 'venda'), 102)
  assert.equal(calcularPreco(100, 2, 'compra'), 98)
})
