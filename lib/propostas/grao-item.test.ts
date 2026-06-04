import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizarGraoItem,
  normalizarGraos,
  somaValorTotal,
  somaQuantidadeTon,
  primeiroGrao,
} from './grao-item'

test('variant A canônica (grao, quantidade, preco, subtotal)', () => {
  const r = normalizarGraoItem({
    grao: 'soja',
    quantidade: 60,
    preco: 2200,
    subtotal: 132000,
  })
  assert.ok(r)
  assert.equal(r!.grao, 'soja')
  assert.equal(r!.quantidade, 60)
  assert.equal(r!.preco, 2200)
  assert.equal(r!.subtotal, 132000)
})

test('variant B legada (commodity, quantidadeSc)', () => {
  const r = normalizarGraoItem({ commodity: 'milho', quantidadeSc: 1000 })
  assert.ok(r)
  assert.equal(r!.grao, 'milho')
  // 1000 sc × 60kg / 1000 = 60 t
  assert.equal(r!.quantidade, 60)
  assert.equal(r!.preco, 0)
  assert.equal(r!.subtotal, 0)
})

test('variant híbrida (grao + quantidadeSc)', () => {
  const r = normalizarGraoItem({ grao: 'soja', quantidadeSc: 1000 })
  assert.ok(r)
  assert.equal(r!.quantidade, 60)
})

test('calcula subtotal quando faltando', () => {
  const r = normalizarGraoItem({ grao: 'soja', quantidade: 10, preco: 2000 })
  assert.equal(r!.subtotal, 20000)
})

test('grão inválido retorna null', () => {
  assert.equal(normalizarGraoItem({ grao: 'feijão', quantidade: 10 }), null)
})

test('quantidade <= 0 retorna null', () => {
  assert.equal(normalizarGraoItem({ grao: 'soja', quantidade: 0, preco: 100 }), null)
})

test('grão case-insensitive', () => {
  const r = normalizarGraoItem({ grao: 'SOJA', quantidade: 10, preco: 2000 })
  assert.equal(r!.grao, 'soja')
})

test('null/undefined/string retorna null', () => {
  assert.equal(normalizarGraoItem(null), null)
  assert.equal(normalizarGraoItem(undefined), null)
  assert.equal(normalizarGraoItem('soja'), null)
})

test('normalizarGraos filtra inválidos', () => {
  const arr = [
    { grao: 'soja', quantidade: 10, preco: 2000 },
    { grao: 'feijão', quantidade: 5 }, // inválido
    { commodity: 'milho', quantidadeSc: 500 },
  ]
  const result = normalizarGraos(arr)
  assert.equal(result.length, 2)
  assert.equal(result[0].grao, 'soja')
  assert.equal(result[1].grao, 'milho')
})

test('somaValorTotal soma subtotais válidos', () => {
  const arr = [
    { grao: 'soja', quantidade: 10, preco: 2000, subtotal: 20000 },
    { grao: 'milho', quantidade: 20, preco: 1500, subtotal: 30000 },
  ]
  assert.equal(somaValorTotal(arr), 50000)
})

test('somaQuantidadeTon soma toneladas', () => {
  const arr = [
    { grao: 'soja', quantidade: 60, preco: 2000 },
    { commodity: 'milho', quantidadeSc: 500 }, // 30 t
  ]
  assert.equal(somaQuantidadeTon(arr), 90)
})

test('primeiroGrao retorna primeiro válido', () => {
  const arr = [
    { grao: 'feijão', quantidade: 5 }, // inválido
    { grao: 'soja', quantidade: 60, preco: 2000 },
  ]
  const r = primeiroGrao(arr)
  assert.equal(r!.grao, 'soja')
})

test('array vazio retorna null em primeiroGrao', () => {
  assert.equal(primeiroGrao([]), null)
})

test('null em primeiroGrao retorna null', () => {
  assert.equal(primeiroGrao(null), null)
})
