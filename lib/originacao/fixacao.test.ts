/**
 * Tests para aplicarFixacao. Standalone via `npx tsx`.
 */
import assert from 'node:assert/strict'
import { aplicarFixacao, precoEfetivoSc } from './fixacao'

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

const HOJE = new Date('2026-05-10T12:00:00Z')

test('fixação total exata fica totalmente_fixado', () => {
  const r = aplicarFixacao({
    contratoFixacao: { qtdTotalSc: 1000, qtdFixadaSc: 0, fixacaoFim: null },
    qtdSc: 1000,
    precoSc: 145,
    agora: HOJE,
  })
  assert.equal(r.ok, true)
  assert.equal(r.novaQtdFixada, 1000)
  assert.equal(r.novaQtdRemanescente, 0)
  assert.equal(r.novoStatus, 'totalmente_fixado')
})

test('fixação parcial mantém status parcial', () => {
  const r = aplicarFixacao({
    contratoFixacao: { qtdTotalSc: 1000, qtdFixadaSc: 0, fixacaoFim: null },
    qtdSc: 300,
    precoSc: 140,
    agora: HOJE,
  })
  assert.equal(r.ok, true)
  assert.equal(r.novaQtdFixada, 300)
  assert.equal(r.novaQtdRemanescente, 700)
  assert.equal(r.novoStatus, 'parcial')
})

test('fixação que completa transição parcial → totalmente_fixado', () => {
  const r = aplicarFixacao({
    contratoFixacao: { qtdTotalSc: 1000, qtdFixadaSc: 700, fixacaoFim: null },
    qtdSc: 300,
    precoSc: 140,
    agora: HOJE,
  })
  assert.equal(r.novoStatus, 'totalmente_fixado')
  assert.equal(r.novaQtdRemanescente, 0)
})

test('fixação > restante retorna erro bloqueante', () => {
  const r = aplicarFixacao({
    contratoFixacao: { qtdTotalSc: 1000, qtdFixadaSc: 800, fixacaoFim: null },
    qtdSc: 300,
    precoSc: 140,
    agora: HOJE,
  })
  assert.equal(r.ok, false)
  assert.ok(r.erros.length > 0)
  assert.match(r.erros[0], /excede saldo/)
})

test('qtdSc <= 0 erro', () => {
  const r = aplicarFixacao({
    contratoFixacao: { qtdTotalSc: 1000, qtdFixadaSc: 0, fixacaoFim: null },
    qtdSc: 0,
    precoSc: 140,
    agora: HOJE,
  })
  assert.equal(r.ok, false)
  assert.match(r.erros[0], /qtdSc/)
})

test('precoSc <= 0 erro', () => {
  const r = aplicarFixacao({
    contratoFixacao: { qtdTotalSc: 1000, qtdFixadaSc: 0, fixacaoFim: null },
    qtdSc: 100,
    precoSc: 0,
    agora: HOJE,
  })
  assert.equal(r.ok, false)
  assert.match(r.erros[0], /precoSc/)
})

test('janela vencida gera alerta mas não bloqueia', () => {
  const ontem = new Date(HOJE.getTime() - 86400000)
  const r = aplicarFixacao({
    contratoFixacao: {
      qtdTotalSc: 1000,
      qtdFixadaSc: 0,
      fixacaoFim: ontem,
    },
    qtdSc: 100,
    precoSc: 140,
    agora: HOJE,
  })
  assert.equal(r.ok, true)
  assert.ok(r.alertas.some((a) => /vencida/.test(a)))
})

test('janela futura sem alerta', () => {
  const amanha = new Date(HOJE.getTime() + 86400000)
  const r = aplicarFixacao({
    contratoFixacao: {
      qtdTotalSc: 1000,
      qtdFixadaSc: 0,
      fixacaoFim: amanha,
    },
    qtdSc: 100,
    precoSc: 140,
    agora: HOJE,
  })
  assert.equal(r.ok, true)
  assert.equal(r.alertas.length, 0)
})

test('precoEfetivoSc soma premio e base', () => {
  assert.equal(precoEfetivoSc(140, 5, 2), 147)
  assert.equal(precoEfetivoSc(140, null, null), 140)
  assert.equal(precoEfetivoSc(140), 140)
})

console.log(`\n[fixacao.test] ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
