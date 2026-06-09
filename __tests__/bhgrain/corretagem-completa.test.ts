import { test } from 'node:test'
import assert from 'node:assert/strict'
import { distribuirComissao, type RegraInput } from '../../lib/comissao/calcular'

// ── base percentual (compat) ────────────────────────────────
test('percentual: 2% de 100k = 2.000 total', () => {
  const r: RegraInput = { pctTotal: 2, pctCorretor: 2, quemPaga: 'comprador' }
  const d = distribuirComissao(r, 100_000)
  assert.equal(d.valorTotal, 2000)
  assert.equal(d.valorComprador, 2000)
  assert.equal(d.valorVendedorPaga, 0)
})

// ── base por tonelada ───────────────────────────────────────
test('por_tonelada: R$ 5/ton × 1.200t = 6.000', () => {
  const r: RegraInput = {
    pctTotal: 0, pctCorretor: 1, baseCalculo: 'por_tonelada', valorPorTonelada: 5,
  }
  const d = distribuirComissao(r, 999_999, 1200)
  assert.equal(d.valorTotal, 6000)
})

test('por_tonelada distribui entre corretor/house', () => {
  const r: RegraInput = {
    pctTotal: 0, pctCorretor: 50, pctHouse: 50,
    baseCalculo: 'por_tonelada', valorPorTonelada: 4,
  }
  const d = distribuirComissao(r, 0, 1000) // 4.000 total
  assert.equal(d.valorTotal, 4000)
  assert.equal(d.corretor, 2000)
  assert.equal(d.house, 2000)
})

// ── quem paga ───────────────────────────────────────────────
test('quem paga: vendedor arca com tudo', () => {
  const r: RegraInput = { pctTotal: 1, pctCorretor: 1, quemPaga: 'vendedor' }
  const d = distribuirComissao(r, 200_000) // 2.000
  assert.equal(d.valorComprador, 0)
  assert.equal(d.valorVendedorPaga, 2000)
})

test('quem paga: ambos 50/50', () => {
  const r: RegraInput = {
    pctTotal: 1, pctCorretor: 1, quemPaga: 'ambos', rateioCompradorPct: 50,
  }
  const d = distribuirComissao(r, 200_000) // 2.000 → 1000/1000
  assert.equal(d.valorComprador, 1000)
  assert.equal(d.valorVendedorPaga, 1000)
})

test('quem paga: ambos 70/30', () => {
  const r: RegraInput = {
    pctTotal: 1, pctCorretor: 1, quemPaga: 'ambos', rateioCompradorPct: 70,
  }
  const d = distribuirComissao(r, 100_000) // 1.000 → 700/300
  assert.equal(d.valorComprador, 700)
  assert.equal(d.valorVendedorPaga, 300)
})

// ── soma das duas formas: split + por-tonelada + quem paga ──
test('integrado: por_tonelada + ambos + split corretor/mesa', () => {
  const r: RegraInput = {
    pctTotal: 0, pctCorretor: 60, pctMesa: 40,
    baseCalculo: 'por_tonelada', valorPorTonelada: 10,
    quemPaga: 'ambos', rateioCompradorPct: 50,
  }
  const d = distribuirComissao(r, 0, 500) // 5.000 total
  assert.equal(d.valorTotal, 5000)
  assert.equal(d.corretor, 3000)
  assert.equal(d.mesa, 2000)
  assert.equal(d.valorComprador, 2500)
  assert.equal(d.valorVendedorPaga, 2500)
})
