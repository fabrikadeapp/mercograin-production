/**
 * Tests para lib/risco/var
 * Run: npx tsx lib/risco/var.test.ts
 */
import { varParametrico, varHistorico, varMonteCarlo, stressTest, type VaRInput } from './var'

let pass = 0
let fail = 0
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('var.test.ts')

function geraHistorico(n: number, basePreco = 12, baseCambio = 5, seed = 1): VaRInput['historico'] {
  // pseudo-random determinístico
  let s = seed
  function rand() { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  const out: VaRInput['historico'] = []
  let soja = basePreco
  let milho = basePreco * 0.5
  let trigo = basePreco * 0.7
  let cambio = baseCambio
  for (let i = 0; i < n; i++) {
    soja *= 1 + (rand() - 0.5) * 0.04
    milho *= 1 + (rand() - 0.5) * 0.03
    trigo *= 1 + (rand() - 0.5) * 0.05
    cambio *= 1 + (rand() - 0.5) * 0.02
    out.push({
      data: new Date(Date.now() - (n - i) * 86400000),
      soja, milho, trigo, cambio,
    })
  }
  return out
}

const baseInput: VaRInput = {
  posicoes: [
    { valorAtualUSD: 100000, cultura: 'soja', tipo: 'long' },
    { valorAtualUSD: 50000, cultura: 'milho', tipo: 'short' },
  ],
  cambioAtualUsdBrl: 5,
  historico: geraHistorico(90),
  confianca: 0.95,
  horizonte: 1,
}

// Test 1: paramétrico retorna VaR > 0
{
  const r = varParametrico(baseInput)
  assert(r.varUSD > 0, 'paramétrico: VaR USD > 0', `got ${r.varUSD}`)
  assert(r.varBRL > 0, 'paramétrico: VaR BRL > 0', `got ${r.varBRL}`)
  assert(r.metodo === 'parametrico', 'paramétrico: metodo correto')
}

// Test 2: histórico retorna VaR > 0
{
  const r = varHistorico(baseInput)
  assert(r.varUSD >= 0, 'histórico: VaR USD >= 0', `got ${r.varUSD}`)
  assert(r.metodo === 'historico', 'histórico: metodo correto')
  assert(r.populacao > 0, 'histórico: populacao > 0')
}

// Test 3: monte carlo retorna VaR > 0
{
  const r = varMonteCarlo(baseInput, 500)
  assert(r.varUSD > 0, 'monte carlo: VaR USD > 0', `got ${r.varUSD}`)
  assert(r.populacao === 500, 'monte carlo: populacao = 500')
}

// Test 4: confiança 99% > confiança 95% (paramétrico)
{
  const r95 = varParametrico({ ...baseInput, confianca: 0.95 })
  const r99 = varParametrico({ ...baseInput, confianca: 0.99 })
  assert(r99.varUSD > r95.varUSD, '99% > 95% (paramétrico)', `${r99.varUSD} vs ${r95.varUSD}`)
}

// Test 5: horizonte 10 dias > 1 dia
{
  const r1 = varParametrico({ ...baseInput, horizonte: 1 })
  const r10 = varParametrico({ ...baseInput, horizonte: 10 })
  assert(r10.varUSD > r1.varUSD, 'h=10 > h=1', `${r10.varUSD} vs ${r1.varUSD}`)
}

// Test 6: stress test queda 20% soja → P&L negativo em long soja
{
  const r = stressTest(baseInput, [{ cultura: 'soja', pct: -0.20 }])
  // long soja 100k * -0.20 = -20000
  assert(r.pnlUSD < 0, 'stress soja queda → pnl USD negativo', `got ${r.pnlUSD}`)
}

// Test 7: short ganha em queda
{
  const inputShort: VaRInput = {
    ...baseInput,
    posicoes: [{ valorAtualUSD: 100000, cultura: 'soja', tipo: 'short' }],
  }
  const r = stressTest(inputShort, [{ cultura: 'soja', pct: -0.20 }])
  assert(r.pnlUSD > 0, 'short ganha em queda', `got ${r.pnlUSD}`)
}

// Test 8: exposição total bate com soma absoluta
{
  const r = varParametrico(baseInput)
  assert(r.exposicaoTotalUSD === 150000, 'exposicao total = 150000', `got ${r.exposicaoTotalUSD}`)
}

// Test 9: choque cambial isolado afeta apenas pnlBRL
{
  const r = stressTest(baseInput, [{ cultura: 'cambio', pct: 0.10 }])
  assert(r.pnlUSD === 0, 'choque cambial não afeta USD', `got ${r.pnlUSD}`)
  assert(r.pnlBRL > 0, 'choque cambial afeta BRL', `got ${r.pnlBRL}`)
}

// Test 10: histórico pequeno não quebra
{
  const r = varHistorico({ ...baseInput, historico: geraHistorico(5) })
  assert(r.metodo === 'historico', 'histórico funciona com 5 pontos')
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
