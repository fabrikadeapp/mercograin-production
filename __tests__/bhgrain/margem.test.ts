import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcularMargem, abaixoDaMargemMinima } from '../../lib/bhgrain/margem'

test('valorTotal = preço × quantidade', () => {
  const r = calcularMargem({ precoVenda: 119.8, custoUnitario: null, quantidade: 1100 })
  assert.equal(r.valorTotal, 131780)
  assert.equal(r.custoTotal, null)
  assert.equal(r.margemPercent, null)
})

test('margem calculada com custo + frete', () => {
  const r = calcularMargem({
    precoVenda: 119.8,
    custoUnitario: 110,
    quantidade: 1100,
    freteUnitario: 3.2,
  })
  assert.equal(r.valorTotal, 131780)
  assert.equal(r.custoTotal, 124520) // (110 + 3.2) * 1100
  assert.equal(r.lucroBruto, 7260)
  assert.ok(r.margemPercent != null && Math.abs(r.margemPercent - 5.509) < 0.01)
})

test('margem 0 quando preço = custo', () => {
  const r = calcularMargem({ precoVenda: 100, custoUnitario: 100, quantidade: 10 })
  assert.equal(r.margemPercent, 0)
  assert.equal(r.lucroBruto, 0)
})

test('margem negativa quando custo > preço', () => {
  const r = calcularMargem({ precoVenda: 100, custoUnitario: 110, quantidade: 10 })
  assert.ok((r.margemPercent ?? 0) < 0)
  assert.ok((r.lucroBruto ?? 0) < 0)
})

test('abaixoDaMargemMinima retorna false quando null', () => {
  assert.equal(abaixoDaMargemMinima(null, 3), false)
  assert.equal(abaixoDaMargemMinima(2, null), false)
})

test('abaixoDaMargemMinima detecta margem abaixo', () => {
  assert.equal(abaixoDaMargemMinima(2.5, 3), true)
  assert.equal(abaixoDaMargemMinima(3, 3), false)
  assert.equal(abaixoDaMargemMinima(5, 3), false)
})
