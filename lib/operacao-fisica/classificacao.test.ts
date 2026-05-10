/**
 * Tests para classificarCarga. Roda standalone via `npx tsx`.
 * Sem dependência de framework — usa assert nativo.
 */
import assert from 'node:assert/strict'
import {
  classificarCarga,
  padraoFromTabela,
  PADROES_DEFAULT,
  DESCONTO_TOTAL_MAX_PCT,
} from './classificacao'

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

const padraoSoja = padraoFromTabela('soja')
const padraoMilho = padraoFromTabela('milho')
const padraoTrigo = padraoFromTabela('trigo')

test('soja no padrão exato gera 0% de desconto', () => {
  const r = classificarCarga(
    { umidade: 14, impureza: 1, ardidos: 0, quebrados: 0 },
    padraoSoja,
    30000
  )
  assert.equal(r.descontoTotalPct, 0)
  assert.equal(r.pesoLiquidoFinalKg, 30000)
  assert.equal(r.alertaForaPadrao.length, 0)
})

test('soja abaixo do padrão NÃO gera ágio (segue 0%)', () => {
  const r = classificarCarga(
    { umidade: 12, impureza: 0.5, ardidos: 0, quebrados: 0 },
    padraoSoja,
    30000
  )
  assert.equal(r.descontoUmidadePct, 0)
  assert.equal(r.descontoImpurezaPct, 0)
  assert.equal(r.descontoTotalPct, 0)
  assert.equal(r.pesoLiquidoFinalKg, 30000)
})

test('soja umidade 15 = (15-14)*1.2 = 1.2% desconto', () => {
  const r = classificarCarga(
    { umidade: 15, impureza: 1 },
    padraoSoja,
    30000
  )
  assert.equal(r.descontoUmidadePct, 1.2)
  assert.equal(r.descontoImpurezaPct, 0)
  assert.equal(r.descontoTotalPct, 1.2)
  assert.equal(r.pesoLiquidoFinalKg, 30000 * 0.988)
})

test('soja umidade 19 (acima do máximo 18) gera alerta', () => {
  const r = classificarCarga(
    { umidade: 19, impureza: 1 },
    padraoSoja,
    30000
  )
  assert.ok(r.alertaForaPadrao.some((a) => a.includes('umidade acima do máximo')))
  assert.equal(r.descontoUmidadePct, 6) // (19-14)*1.2
})

test('múltiplas medidas somam corretamente', () => {
  // umidade 16, impureza 2, ardidos 3, quebrados 4 (soja)
  // umid: (16-14)*1.2 = 2.4
  // impur: (2-1)*1.0 = 1.0
  // ardid: 3*2.0 = 6.0
  // quebr: 4*0.5 = 2.0
  // total = 11.4
  const r = classificarCarga(
    { umidade: 16, impureza: 2, ardidos: 3, quebrados: 4 },
    padraoSoja,
    30000
  )
  assert.equal(r.descontoUmidadePct, 2.4)
  assert.equal(r.descontoImpurezaPct, 1.0)
  assert.equal(r.descontoArdidosPct, 6.0)
  assert.equal(r.descontoQuebradosPct, 2.0)
  assert.equal(r.descontoTotalPct, 11.4)
  assert.equal(r.pesoLiquidoFinalKg, 30000 * (1 - 0.114))
})

test('cap em 30%: medidas extremas não levam desconto além de 30%', () => {
  const r = classificarCarga(
    { umidade: 30, impureza: 20, ardidos: 50, quebrados: 50 },
    padraoSoja,
    10000
  )
  assert.equal(r.descontoTotalPct, DESCONTO_TOTAL_MAX_PCT)
  assert.equal(r.pesoLiquidoFinalKg, 10000 * 0.7)
  assert.ok(r.alertaForaPadrao.some((a) => a.includes('capeado')))
})

test('milho usa fatores próprios', () => {
  const r = classificarCarga(
    { umidade: 16, impureza: 1.5, ardidos: 0, quebrados: 0 },
    padraoMilho,
    25000
  )
  // (16-14)*1.0 = 2.0
  assert.equal(r.descontoUmidadePct, 2.0)
  assert.equal(r.descontoImpurezaPct, 0)
  assert.equal(r.descontoTotalPct, 2.0)
})

test('trigo: PH abaixo do mínimo gera alerta sem desconto', () => {
  const r = classificarCarga(
    { umidade: 13, impureza: 1, pesoHectolitroKg: 75 },
    padraoTrigo,
    20000
  )
  assert.equal(r.descontoTotalPct, 0)
  assert.ok(
    r.alertaForaPadrao.some((a) => a.includes('peso hectolitro abaixo'))
  )
})

test('peso bruto 0 retorna líquido 0 sem erro', () => {
  const r = classificarCarga({ umidade: 14, impureza: 1 }, padraoSoja, 0)
  assert.equal(r.pesoLiquidoFinalKg, 0)
})

test('peso negativo lança erro', () => {
  assert.throws(() =>
    classificarCarga({ umidade: 14, impureza: 1 }, padraoSoja, -100)
  )
})

test('padroes default cobrem soja, milho, trigo', () => {
  assert.ok(PADROES_DEFAULT.soja)
  assert.ok(PADROES_DEFAULT.milho)
  assert.ok(PADROES_DEFAULT.trigo)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
