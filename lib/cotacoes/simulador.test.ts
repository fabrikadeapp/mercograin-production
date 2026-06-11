/**
 * Tests para lib/cotacoes/simulador.ts
 * Run: npx tsx lib/cotacoes/simulador.test.ts
 */
import {
  simularPrecoGrao,
  simularTradings,
  simularPracas,
  fatorBushelTonelada,
  simuladorVazio,
  type SimuladorInput,
} from './simulador'

let pass = 0
let fail = 0

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function approxEq(a: number, b: number, eps = 1e-4) {
  return Math.abs(a - b) < eps
}

// ── Fator bushel→tonelada (densidade USDA) ──────────────────────────────────
assert(
  approxEq(fatorBushelTonelada('soja'), 36.7437, 1e-3),
  'fator soja ≈ 36,7437 (coerente com 36,7454 da planilha)',
  `${fatorBushelTonelada('soja')}`,
)
assert(
  approxEq(fatorBushelTonelada('milho'), 39.3681, 1e-3),
  'fator milho ≈ 39,37 (coerente com a planilha)',
  `${fatorBushelTonelada('milho')}`,
)
assert(
  approxEq(fatorBushelTonelada('trigo'), 36.7437, 1e-3),
  'fator trigo ≈ 36,7437',
  `${fatorBushelTonelada('trigo')}`,
)

// ── Caso realista soja: CBOT 1320¢ + prêmio 55¢, FOBBINGS -10, câmbio 5,40 ──
{
  const input: SimuladorInput = {
    grao: 'soja',
    cbotCentavosBu: 1320,
    premioCentavosBu: 55,
    fobbingsUsdTon: -10,
    cambioUsdBrl: 5.4,
    fretePorSacaBrl: 3,
  }
  const r = simularPrecoGrao(input)

  // US$/bu = (1320 + 55) / 100 = 13,75
  assert(approxEq(r.usdPorBushel, 13.75), 'soja: US$/bu = 13,75', `${r.usdPorBushel}`)

  // US$/t bruto = 13,75 × 36,7437 = 505,226...
  assert(approxEq(r.usdPorToneladaBruto, 13.75 * 36.7437, 1e-2), 'soja: US$/t bruto', `${r.usdPorToneladaBruto}`)

  // US$/t líquido = bruto - 10
  assert(
    approxEq(r.usdPorToneladaLiquido, r.usdPorToneladaBruto - 10, 1e-6),
    'soja: FOBBINGS subtrai 10 do US$/t',
    `${r.usdPorToneladaLiquido}`,
  )

  // US$/saca = US$/t líquido / 16,6667
  assert(approxEq(r.usdPorSaca, r.usdPorToneladaLiquido / (1000 / 60), 1e-6), 'soja: US$/saca = US$/t ÷ 16,667', `${r.usdPorSaca}`)

  // R$/saca porto = US$/saca × câmbio
  assert(approxEq(r.brlPorSacaPorto, r.usdPorSaca * 5.4, 1e-6), 'soja: R$/saca porto = US$/saca × câmbio', `${r.brlPorSacaPorto}`)

  // R$/saca FOB origem = porto - frete
  assert(approxEq(r.brlPorSacaFobOrigem, r.brlPorSacaPorto - 3, 1e-6), 'soja: FOB origem = porto - frete', `${r.brlPorSacaFobOrigem}`)

  // Sanidade: soja a 13,75/bu, câmbio 5,40 → algo em torno de R$ 160/sc no porto
  assert(r.brlPorSacaPorto > 150 && r.brlPorSacaPorto < 175, 'soja: R$/saca porto em faixa plausível (150–175)', `${r.brlPorSacaPorto.toFixed(2)}`)
}

// ── Prêmio negativo reduz o preço ───────────────────────────────────────────
{
  const base: SimuladorInput = {
    grao: 'soja',
    cbotCentavosBu: 1300,
    premioCentavosBu: 0,
    fobbingsUsdTon: -10,
    cambioUsdBrl: 5,
    fretePorSacaBrl: 0,
  }
  const semPremio = simularPrecoGrao(base).brlPorSacaPorto
  const premioNeg = simularPrecoGrao({ ...base, premioCentavosBu: -50 }).brlPorSacaPorto
  assert(premioNeg < semPremio, 'prêmio negativo reduz o preço', `${premioNeg} < ${semPremio}`)
}

// ── Câmbio multiplica linearmente o preço em reais ──────────────────────────
{
  const base: SimuladorInput = {
    grao: 'milho',
    cbotCentavosBu: 480,
    premioCentavosBu: 20,
    fobbingsUsdTon: -10,
    cambioUsdBrl: 5,
    fretePorSacaBrl: 0,
  }
  const a = simularPrecoGrao(base).brlPorSacaPorto
  const b = simularPrecoGrao({ ...base, cambioUsdBrl: 6 }).brlPorSacaPorto
  assert(approxEq(b, a * 1.2, 1e-4), 'câmbio 5→6 aumenta R$ em 20%', `${b} vs ${a * 1.2}`)
}

// ── Frete reduz exatamente seu valor do preço FOB origem ────────────────────
{
  const base: SimuladorInput = {
    grao: 'soja',
    cbotCentavosBu: 1300,
    premioCentavosBu: 50,
    fobbingsUsdTon: -10,
    cambioUsdBrl: 5.4,
    fretePorSacaBrl: 0,
  }
  const semFrete = simularPrecoGrao(base).brlPorSacaFobOrigem
  const comFrete = simularPrecoGrao({ ...base, fretePorSacaBrl: 4.5 }).brlPorSacaFobOrigem
  assert(approxEq(semFrete - comFrete, 4.5, 1e-6), 'frete de R$4,50 reduz FOB origem em 4,50', `${semFrete - comFrete}`)
}

// ── simularTradings ordena do maior prêmio para o menor preço ───────────────
{
  const base = {
    grao: 'soja' as const,
    cbotCentavosBu: 1320,
    fobbingsUsdTon: -10,
    cambioUsdBrl: 5.4,
    fretePorSacaBrl: 3,
  }
  const res = simularTradings(base, [
    { nome: 'Cargill', premioCentavosBu: 40 },
    { nome: 'Bunge', premioCentavosBu: 80 },
    { nome: 'ADM', premioCentavosBu: 60 },
  ])
  assert(res[0].nome === 'Bunge', 'tradings: maior prêmio (Bunge) fica no topo', res[0].nome)
  assert(
    res[0].brlPorSacaFobOrigem >= res[1].brlPorSacaFobOrigem &&
      res[1].brlPorSacaFobOrigem >= res[2].brlPorSacaFobOrigem,
    'tradings: ordenados decrescente por FOB origem',
  )
}

// ── simularPracas: menor frete → maior preço porteira ───────────────────────
{
  const base = {
    grao: 'soja' as const,
    cbotCentavosBu: 1320,
    premioCentavosBu: 55,
    fobbingsUsdTon: -10,
    cambioUsdBrl: 5.4,
  }
  const res = simularPracas(base, [
    { nome: 'Erechim', fretePorSacaBrl: 4.2 },
    { nome: 'Cruz Alta', fretePorSacaBrl: 3.0 },
    { nome: 'Soledade', fretePorSacaBrl: 3.3 },
  ])
  assert(res[0].nome === 'Cruz Alta', 'praças: menor frete (Cruz Alta) tem maior preço', res[0].nome)
}

// ── simuladorVazio ──────────────────────────────────────────────────────────
{
  const v = simuladorVazio('milho')
  assert(v.grao === 'milho' && v.cbotCentavosBu === 0 && v.cambioUsdBrl === 0, 'simuladorVazio zera CBOT e câmbio')
  assert(v.fobbingsUsdTon === -10, 'simuladorVazio default FOBBINGS -10')
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
