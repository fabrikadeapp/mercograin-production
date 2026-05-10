/**
 * Tests para barter.
 */
import assert from 'node:assert/strict'
import { calcularEquivalenciaGrao, calcularBarter } from './barter'

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ok ${name}`)
    passed++
  } catch (err: any) {
    console.error(`  FAIL ${name}`)
    console.error('    ', err?.message || err)
    failed++
  }
}

test('equivalência simples', () => {
  // Adubo R$ 14.500 / preço soja R$ 145 = 100 sc
  assert.equal(calcularEquivalenciaGrao(14500, 145), 100)
})

test('preço zero retorna 0', () => {
  assert.equal(calcularEquivalenciaGrao(14500, 0), 0)
})

test('valor negativo retorna 0', () => {
  assert.equal(calcularEquivalenciaGrao(-100, 145), 0)
})

test('calcularBarter consolida valor e equivalência', () => {
  const r = calcularBarter({ quantidade: 10, precoUnit: 1450 }, 145)
  assert.equal(r.valorTotal, 14500)
  assert.equal(r.qtdGraoEquivalenteSc, 100)
})

test('calcularBarter com NaN retorna 0', () => {
  const r = calcularBarter({ quantidade: NaN, precoUnit: 100 }, 145)
  assert.equal(r.valorTotal, 0)
  assert.equal(r.qtdGraoEquivalenteSc, 0)
})

console.log(`\n[barter.test] ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
