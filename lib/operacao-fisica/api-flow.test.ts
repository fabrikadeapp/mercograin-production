/**
 * Smoke test do fluxo: classificação → ticket → finalização de romaneio.
 * Testa apenas a lógica pura de cálculo do peso final agregado, sem mockar
 * Prisma — a integração HTTP é coberta manualmente no QA.
 */
import assert from 'node:assert/strict'
import {
  classificarCarga,
  PADROES_DEFAULT,
} from './classificacao'
import { calcularSaldoLote } from './lote-balance'

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

const KG_POR_SACA = 60

test('finalização de romaneio: 3 tickets viram lote', () => {
  // 3 caminhões de soja, todos com classificação leve
  const padrao = { cultura: 'soja' as const, ...PADROES_DEFAULT.soja }
  const tickets = [
    { brutoKg: 30000, taraKg: 10000, umidade: 14, impureza: 1 }, // padrão
    { brutoKg: 31000, taraKg: 10500, umidade: 15, impureza: 1.5 }, // umid +1%
    { brutoKg: 29500, taraKg: 9800, umidade: 14, impureza: 2 }, // imp +1%
  ]
  let totalLiquidoFinal = 0
  for (const t of tickets) {
    const liq = t.brutoKg - t.taraKg
    const r = classificarCarga({ umidade: t.umidade, impureza: t.impureza }, padrao, liq)
    totalLiquidoFinal += r.pesoLiquidoFinalKg
  }
  const totalSc = totalLiquidoFinal / KG_POR_SACA
  // Sanity checks
  assert.ok(totalLiquidoFinal > 50000)
  assert.ok(totalSc > 800)
  // Lote criado com essa quantidade, depois saldo = sc
  const saldoFinal = calcularSaldoLote(totalSc, [])
  assert.equal(saldoFinal, Math.round(totalSc * 100) / 100)
})

test('quebra técnica reduz saldo do lote pós-finalização', () => {
  const saldoInicial = 1000
  const saldo = calcularSaldoLote(saldoInicial, [
    { tipo: 'quebra_tecnica', qtdSc: 25 },
  ])
  assert.equal(saldo, 975)
})

test('classificação fora do máximo gera alerta sem rejeição', () => {
  const padrao = { cultura: 'soja' as const, ...PADROES_DEFAULT.soja }
  const r = classificarCarga({ umidade: 19, impureza: 1 }, padrao, 30000)
  assert.ok(r.alertaForaPadrao.length > 0)
  // Mas ticket pode ser salvo (o desconto continua aplicado)
  assert.ok(r.descontoTotalPct > 0)
  assert.ok(r.pesoLiquidoFinalKg < 30000)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
