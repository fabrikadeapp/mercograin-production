import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcularSugestaoPreco, verificarPrecoNaBanda } from './sugestao-preco'

const NOW = new Date('2026-06-03T12:00:00')

test('sem mercado, sem histórico → null + warning', () => {
  const r = calcularSugestaoPreco({
    grao: 'soja',
    mercadoBrlTon: null,
    fonteMercado: 'indisponivel',
    capturadoEm: NOW,
    margemDefault: 0.03,
    historicoCliente: [],
  })
  assert.equal(r.sugeridoBaseBrlTon, null)
  assert.equal(r.sugeridoClienteBrlTon, null)
  assert.equal(r.bandaCliente, null)
  assert.ok(r.warnings.some((w) => w.includes('Mercado indisponível')))
})

test('mercado + margem → base = mercado × (1+margem)', () => {
  const r = calcularSugestaoPreco({
    grao: 'soja',
    mercadoBrlTon: 2000,
    fonteMercado: 'CBOT',
    capturadoEm: NOW,
    margemDefault: 0.05,
    historicoCliente: [],
  })
  assert.equal(r.sugeridoBaseBrlTon, 2100)
})

test('mercado sem margem → preço de mercado puro + warning', () => {
  const r = calcularSugestaoPreco({
    grao: 'soja',
    mercadoBrlTon: 2000,
    fonteMercado: 'CBOT',
    capturadoEm: NOW,
    margemDefault: null,
    historicoCliente: [],
  })
  assert.equal(r.sugeridoBaseBrlTon, 2000)
  assert.ok(r.warnings.some((w) => w.includes('margem default')))
})

test('histórico com 2 pontos consistentes → premioMedio + sugeridoCliente', () => {
  const r = calcularSugestaoPreco({
    grao: 'soja',
    mercadoBrlTon: 2000,
    fonteMercado: 'CBOT',
    capturadoEm: NOW,
    margemDefault: 0.03,
    historicoCliente: [
      { precoBrlTon: 2040, marketBrlTon: 2000, data: new Date('2026-04-01') }, // +2%
      { precoBrlTon: 2060, marketBrlTon: 2020, data: new Date('2026-05-01') }, // +1.98%
    ],
  })
  assert.ok(r.bandaCliente)
  assert.equal(r.bandaCliente!.n, 2)
  // premio = mediana(0.02, 0.0198) = média dos dois ≈ 0.0199
  assert.ok(Math.abs(r.bandaCliente!.premioMedio - 0.0199) < 0.001)
  // sugeridoCliente = 2000 × 1.0199 ≈ 2039.8
  assert.ok(r.sugeridoClienteBrlTon && Math.abs(r.sugeridoClienteBrlTon - 2039.8) < 1)
})

test('cliente paga menos que margem default → warning', () => {
  const r = calcularSugestaoPreco({
    grao: 'soja',
    mercadoBrlTon: 2000,
    fonteMercado: 'CBOT',
    capturadoEm: NOW,
    margemDefault: 0.05, // queremos 5%
    historicoCliente: [
      // cliente só paga ~1% sobre mercado
      { precoBrlTon: 2020, marketBrlTon: 2000, data: new Date('2026-04-01') },
      { precoBrlTon: 2010, marketBrlTon: 1990, data: new Date('2026-05-01') },
    ],
  })
  assert.ok(r.sugeridoClienteBrlTon)
  assert.ok(r.sugeridoBaseBrlTon)
  assert.ok(r.sugeridoClienteBrlTon! < r.sugeridoBaseBrlTon! * 0.97)
  assert.ok(r.warnings.some((w) => w.includes('historicamente paga')))
})

test('histórico sem market → banda OK, prêmio=0', () => {
  const r = calcularSugestaoPreco({
    grao: 'soja',
    mercadoBrlTon: 2000,
    fonteMercado: 'CBOT',
    capturadoEm: NOW,
    margemDefault: 0.03,
    historicoCliente: [
      { precoBrlTon: 2100, marketBrlTon: null, data: new Date('2026-04-01') },
      { precoBrlTon: 2150, marketBrlTon: null, data: new Date('2026-05-01') },
      { precoBrlTon: 2080, marketBrlTon: null, data: new Date('2026-05-15') },
    ],
  })
  assert.ok(r.bandaCliente)
  assert.equal(r.bandaCliente!.minBrlTon, 2080)
  assert.equal(r.bandaCliente!.maxBrlTon, 2150)
  assert.equal(r.bandaCliente!.premioMedio, 0)
})

test('verificarPrecoNaBanda — dentro', () => {
  const banda = { n: 3, premioMedio: 0.01, minBrlTon: 2000, maxBrlTon: 2200, medianaBrlTon: 2100 }
  const v = verificarPrecoNaBanda(2100, banda)
  assert.equal(v?.status, 'dentro')
})

test('verificarPrecoNaBanda — abaixo', () => {
  const banda = { n: 3, premioMedio: 0.01, minBrlTon: 2000, maxBrlTon: 2200, medianaBrlTon: 2100 }
  const v = verificarPrecoNaBanda(1900, banda)
  assert.equal(v?.status, 'abaixo')
  assert.ok(v!.desvioPct > 0)
})

test('verificarPrecoNaBanda — acima', () => {
  const banda = { n: 3, premioMedio: 0.01, minBrlTon: 2000, maxBrlTon: 2200, medianaBrlTon: 2100 }
  const v = verificarPrecoNaBanda(2300, banda)
  assert.equal(v?.status, 'acima')
})

test('verificarPrecoNaBanda — banda com n<2 → null', () => {
  const banda = { n: 1, premioMedio: 0, minBrlTon: 2000, maxBrlTon: 2000, medianaBrlTon: 2000 }
  const v = verificarPrecoNaBanda(2100, banda)
  assert.equal(v, null)
})
