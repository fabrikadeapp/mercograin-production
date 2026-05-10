import assert from 'node:assert/strict'
import { calcularSaldoLote, breakdownLote } from './lote-balance'

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ok ${name}`)
    passed++
  } catch (err: any) {
    console.error(`  FAIL ${name}\n    `, err?.message || err)
    failed++
  }
}

test('saldo inicial sem movimentações = inicial', () => {
  assert.equal(calcularSaldoLote(1000, []), 1000)
})

test('entrada soma, saida subtrai', () => {
  const s = calcularSaldoLote(1000, [
    { tipo: 'entrada', qtdSc: 500 },
    { tipo: 'saida', qtdSc: 300 },
  ])
  assert.equal(s, 1200)
})

test('quebra_tecnica e rebaixe subtraem', () => {
  const s = calcularSaldoLote(1000, [
    { tipo: 'quebra_tecnica', qtdSc: 50 },
    { tipo: 'rebaixe', qtdSc: 25 },
  ])
  assert.equal(s, 925)
})

test('transferencia subtrai do lote origem', () => {
  const s = calcularSaldoLote(2000, [{ tipo: 'transferencia', qtdSc: 800 }])
  assert.equal(s, 1200)
})

test('breakdown agrupa por tipo corretamente', () => {
  const b = breakdownLote(1000, [
    { tipo: 'entrada', qtdSc: 200 },
    { tipo: 'saida', qtdSc: 100 },
    { tipo: 'quebra_tecnica', qtdSc: 30 },
    { tipo: 'transferencia', qtdSc: 50 },
    { tipo: 'rebaixe', qtdSc: 20 },
  ])
  assert.equal(b.totalEntradasSc, 200)
  assert.equal(b.totalSaidasSc, 100)
  assert.equal(b.totalQuebrasSc, 30)
  assert.equal(b.totalTransferidoSc, 50)
  assert.equal(b.totalRebaixeSc, 20)
  assert.equal(b.saldoFinalSc, 1000 + 200 - 100 - 30 - 50 - 20)
})

test('valores negativos em qtdSc são tratados como módulo', () => {
  const s = calcularSaldoLote(500, [{ tipo: 'saida', qtdSc: -100 }])
  assert.equal(s, 400)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
