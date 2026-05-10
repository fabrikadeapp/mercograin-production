/**
 * Tests para washout.
 */
import assert from 'node:assert/strict'
import { calcularImpactoWashout } from './washout'

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

test('washout simples sem fixações nem adiantamentos', () => {
  const r = calcularImpactoWashout({
    contratoId: 'c1',
    qtdContratadaSc: 1000,
    qtdJaFixadaSc: 0,
    custoWashout: 5000,
  })
  assert.equal(r.qtdLiberada, 1000)
  assert.equal(r.custoTotalEstimado, 5000)
  assert.equal(r.fixacoesCanceladas, 0)
  assert.equal(r.adiantamentosAReembolsar, 0)
})

test('washout com fixação parcial libera só restante', () => {
  const r = calcularImpactoWashout({
    contratoId: 'c1',
    qtdContratadaSc: 1000,
    qtdJaFixadaSc: 300,
    fixacoesAbertas: [
      { id: 'f1', qtdSc: 200, precoSc: 140 },
      { id: 'f2', qtdSc: 100, precoSc: 145 },
    ],
  })
  assert.equal(r.qtdLiberada, 700)
  assert.equal(r.fixacoesCanceladas, 2)
  assert.equal(r.qtdFixacoesCanceladasSc, 300)
})

test('washout com adiantamento aberto soma reembolso ao custo', () => {
  const r = calcularImpactoWashout({
    contratoId: 'c1',
    qtdContratadaSc: 1000,
    qtdJaFixadaSc: 0,
    custoWashout: 1000,
    adiantamentosAbertos: [
      {
        id: 'a1',
        valor: 50000,
        qtdEsperadaSc: 1000,
        qtdAbatidaSc: 0,
        status: 'aberto',
      },
    ],
  })
  assert.equal(r.adiantamentosAReembolsar, 1)
  assert.equal(r.valorAReembolsar, 50000)
  assert.equal(r.custoTotalEstimado, 51000)
})

test('washout com adiantamento parcialmente abatido reembolsa proporcional', () => {
  const r = calcularImpactoWashout({
    contratoId: 'c1',
    qtdContratadaSc: 1000,
    qtdJaFixadaSc: 0,
    adiantamentosAbertos: [
      {
        id: 'a1',
        valor: 50000,
        qtdEsperadaSc: 1000,
        qtdAbatidaSc: 600,
        status: 'parcial',
      },
    ],
  })
  // 1 - 0.6 = 0.4 → 50000 * 0.4 = 20000
  assert.equal(r.valorAReembolsar, 20000)
})

test('adiantamento quitado não gera reembolso', () => {
  const r = calcularImpactoWashout({
    contratoId: 'c1',
    qtdContratadaSc: 1000,
    adiantamentosAbertos: [
      {
        id: 'a1',
        valor: 50000,
        qtdEsperadaSc: 1000,
        qtdAbatidaSc: 1000,
        status: 'quitado',
      },
    ],
  })
  assert.equal(r.adiantamentosAReembolsar, 0)
  assert.equal(r.valorAReembolsar, 0)
})

console.log(`\n[washout.test] ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
