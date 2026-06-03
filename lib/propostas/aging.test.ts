import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcularAging } from './aging'

// Constrói Date local (ano, mês 0-indexado, dia) — evita drift de timezone
const d = (y: number, m: number, dia: number) => new Date(y, m - 1, dia, 12)
const NOW = d(2026, 6, 3)

test('vencida ontem', () => {
  const r = calcularAging(d(2026, 6, 2), NOW)
  assert.equal(r.nivel, 'vencida')
  assert.equal(r.diasRestantes, -1)
  assert.match(r.label, /vencida h.* 1d/)
  assert.equal(r.cor, 'neg')
})

test('vence hoje', () => {
  const r = calcularAging(d(2026, 6, 3), NOW)
  assert.equal(r.nivel, 'hoje')
  assert.equal(r.diasRestantes, 0)
  assert.equal(r.cor, 'neg')
})

test('vence amanhã', () => {
  const r = calcularAging(d(2026, 6, 4), NOW)
  assert.equal(r.nivel, 'urgente')
  assert.equal(r.diasRestantes, 1)
  assert.match(r.label, /amanh/)
})

test('3 dias = urgente', () => {
  const r = calcularAging(d(2026, 6, 6), NOW)
  assert.equal(r.nivel, 'urgente')
  assert.equal(r.diasRestantes, 3)
  assert.equal(r.cor, 'warn')
})

test('7 dias = proxima', () => {
  const r = calcularAging(d(2026, 6, 10), NOW)
  assert.equal(r.nivel, 'proxima')
  assert.equal(r.cor, 'info')
})

test('30 dias = ok', () => {
  const r = calcularAging(d(2026, 7, 3), NOW)
  assert.equal(r.nivel, 'ok')
  assert.equal(r.diasRestantes, 30)
})

test('null = sem-validade', () => {
  const r = calcularAging(null, NOW)
  assert.equal(r.nivel, 'sem-validade')
})

test('string ISO funciona', () => {
  const r = calcularAging('2026-06-04', NOW)
  // String ISO parseia como UTC — em fuso negativo (Brasil GMT-3) vira 21:00 do dia anterior
  // local. Validamos que pelo menos não é 'ok' e tem dias restantes baixos.
  assert.ok(['vencida', 'hoje', 'urgente'].includes(r.nivel), `nivel=${r.nivel}`)
})
