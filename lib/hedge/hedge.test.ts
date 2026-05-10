/**
 * Tests para lib/hedge — conversao, pnl, exposicao.
 * Run: npx tsx lib/hedge/hedge.test.ts
 */
import {
  CBOT_CONTRATO,
  bushelsParaSacas,
  sacasParaBushels,
  precoUsdBuParaBrlSc,
  precoBrlScParaUsdBu,
  contratosParaSacas,
} from './conversao'
import { calcularPnL, calcularPnLFinal } from './pnl'
import { calcularExposicao, resumirLongShort } from './exposicao'

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

function approxEq(a: number, b: number, eps = 1e-3) {
  return Math.abs(a - b) < eps
}

console.log('hedge.test.ts')

// === Conversão ===
{
  const sc = bushelsParaSacas(5000, CBOT_CONTRATO.ZS.kgPorBushel)
  // 5000 * 27.2155 / 60 = 2267.96
  assert(approxEq(sc, 2267.958333, 0.01), 'bushels→sacas (soja)', `got ${sc}`)
}
{
  const bu = sacasParaBushels(2267.958333, CBOT_CONTRATO.ZS.kgPorBushel)
  assert(approxEq(bu, 5000, 0.01), 'sacas→bushels (round-trip)', `got ${bu}`)
}
{
  // USD/bu = 14, USD/BRL = 5, soja → R$/sc = 14*5*(60/27.2155)
  const r$ = precoUsdBuParaBrlSc(14, 5, CBOT_CONTRATO.ZS.kgPorBushel)
  // = 70 * 2.2046 ≈ 154.32
  assert(approxEq(r$, 154.323, 0.01), 'precoUsdBuParaBrlSc (soja)', `got ${r$}`)
}
{
  const usd = precoBrlScParaUsdBu(154.323, 5, CBOT_CONTRATO.ZS.kgPorBushel)
  assert(approxEq(usd, 14, 0.01), 'precoBrlScParaUsdBu (round-trip)', `got ${usd}`)
}
{
  const sc = contratosParaSacas(1, 'ZS')
  // 136077.5 / 60 ≈ 2267.96
  assert(approxEq(sc, 2267.958, 0.01), 'contratosParaSacas (1 soja)', `got ${sc}`)
}

// === P&L ===
{
  // Long, preço sobe: lucro
  const r = calcularPnL(
    {
      tipo: 'long',
      qtdContratos: 1,
      cultura: 'ZS',
      precoEntradaUsdBu: 14,
      cambioEntradaUsdBrl: 5,
    },
    { precoMercadoUsdBu: 15, cambioMercadoUsdBrl: 5 },
  )
  // (15-14) * 1 * 5000 = +5000 USD; câmbio igual → BRL = 5000*5 = 25000
  assert(approxEq(r.pnlUSD, 5000, 0.01), 'Long ganho USD', `got ${r.pnlUSD}`)
  assert(approxEq(r.pnlBRL, 25000, 0.01), 'Long ganho BRL', `got ${r.pnlBRL}`)
  assert(r.pnlPctEntrada > 0, 'Long ganho pct positivo')
}
{
  // Long, preço cai: perda
  const r = calcularPnL(
    {
      tipo: 'long',
      qtdContratos: 2,
      cultura: 'ZS',
      precoEntradaUsdBu: 14,
      cambioEntradaUsdBrl: 5,
    },
    { precoMercadoUsdBu: 13, cambioMercadoUsdBrl: 5 },
  )
  // (13-14)*2*5000 = -10000
  assert(approxEq(r.pnlUSD, -10000, 0.01), 'Long perda USD', `got ${r.pnlUSD}`)
}
{
  // Short, preço cai: lucro
  const r = calcularPnL(
    {
      tipo: 'short',
      qtdContratos: 1,
      cultura: 'ZS',
      precoEntradaUsdBu: 14,
      cambioEntradaUsdBrl: 5,
    },
    { precoMercadoUsdBu: 13, cambioMercadoUsdBrl: 5 },
  )
  // -(13-14)*1*5000 = +5000
  assert(approxEq(r.pnlUSD, 5000, 0.01), 'Short ganho USD', `got ${r.pnlUSD}`)
}
{
  // Short, preço sobe: perda
  const r = calcularPnL(
    {
      tipo: 'short',
      qtdContratos: 1,
      cultura: 'ZS',
      precoEntradaUsdBu: 14,
      cambioEntradaUsdBrl: 5,
    },
    { precoMercadoUsdBu: 15, cambioMercadoUsdBrl: 5 },
  )
  assert(approxEq(r.pnlUSD, -5000, 0.01), 'Short perda USD', `got ${r.pnlUSD}`)
}
{
  // Decomposição preço × câmbio: preço estável, dólar sobe
  const r = calcularPnL(
    {
      tipo: 'long',
      qtdContratos: 1,
      cultura: 'ZS',
      precoEntradaUsdBu: 14,
      cambioEntradaUsdBrl: 5,
    },
    { precoMercadoUsdBu: 14, cambioMercadoUsdBrl: 5.5 },
  )
  assert(approxEq(r.pnlUSD, 0, 0.01), 'Câmbio: pnl USD = 0', `got ${r.pnlUSD}`)
  // notional = 14*5000 = 70000 USD; deltaCambio = 0.5 → 35000 BRL extras
  assert(approxEq(r.pnlBRL, 35000, 0.01), 'Câmbio: pnl BRL > 0', `got ${r.pnlBRL}`)
  assert(r.pnlCambialUSD > 0, 'Decomp cambialUSD positivo')
}
{
  // Corretagem reduz P&L
  const r = calcularPnL(
    {
      tipo: 'long',
      qtdContratos: 1,
      cultura: 'ZS',
      precoEntradaUsdBu: 14,
      cambioEntradaUsdBrl: 5,
      corretagemUSD: 50,
    },
    { precoMercadoUsdBu: 15, cambioMercadoUsdBrl: 5 },
  )
  assert(approxEq(r.pnlUSD, 4950, 0.01), 'Corretagem subtrai do P&L', `got ${r.pnlUSD}`)
}
{
  const r = calcularPnLFinal(
    {
      tipo: 'long',
      qtdContratos: 1,
      cultura: 'ZS',
      precoEntradaUsdBu: 14,
      cambioEntradaUsdBrl: 5,
    },
    { precoSaidaUsdBu: 14.5, cambioSaidaUsdBrl: 5.2 },
  )
  // (14.5-14)*5000 = +2500 USD
  assert(approxEq(r.pnlUSD, 2500, 0.01), 'PnL final saída', `got ${r.pnlUSD}`)
}

// === Exposição ===
{
  const fut = new Date(Date.now() + 60 * 86400_000)
  // 100% hedgeado
  const r = calcularExposicao(
    [{ valorTotalUSD: 100000, vencimento: fut }],
    [{ qtdContratosUSD: 100000, tipo: 'short' }],
  )
  assert(approxEq(r.hedgeRatio, 1, 0.001), 'Exposição 100% hedge ratio = 1')
  assert(!r.alertaSubExposto, '100% hedge: sem alerta')
  assert(approxEq(r.exposicaoLiquidaUSD, 0, 0.001), 'Exposição 100%: líquida 0')
}
{
  const fut = new Date(Date.now() + 30 * 86400_000)
  // 50% hedgeado, prazo curto → alerta
  const r = calcularExposicao(
    [{ valorTotalUSD: 200000, vencimento: fut }],
    [{ qtdContratosUSD: 100000, tipo: 'short' }],
  )
  assert(approxEq(r.hedgeRatio, 0.5, 0.001), '50% hedge ratio', `got ${r.hedgeRatio}`)
  assert(r.alertaSubExposto, 'Sub-exposto + prazo curto → alerta')
  assert(approxEq(r.exposicaoLiquidaUSD, 100000, 0.001), 'Exposição líquida = 100k')
}
{
  const fut = new Date(Date.now() + 200 * 86400_000)
  // 50% hedgeado MAS prazo longo → sem alerta
  const r = calcularExposicao(
    [{ valorTotalUSD: 200000, vencimento: fut }],
    [{ qtdContratosUSD: 100000, tipo: 'short' }],
  )
  assert(!r.alertaSubExposto, 'Sub-exposto + prazo longo → sem alerta')
}
{
  // NDF conta como cobertura
  const fut = new Date(Date.now() + 60 * 86400_000)
  const r = calcularExposicao(
    [{ valorTotalUSD: 100000, vencimento: fut }],
    [],
    [{ notionalUSD: 80000, direcao: 'venda' }],
  )
  assert(approxEq(r.totalNdfUSD, 80000, 0.001), 'NDF entra no totalNdfUSD')
  assert(approxEq(r.hedgeRatio, 0.8, 0.001), 'hedgeRatio com NDF', `got ${r.hedgeRatio}`)
}

// === Long×Short por cultura ===
{
  const r = resumirLongShort([
    { cultura: 'soja', tipo: 'long', qtdContratos: 5, notionalUSD: 350000 },
    { cultura: 'soja', tipo: 'short', qtdContratos: 3, notionalUSD: 210000 },
    { cultura: 'milho', tipo: 'long', qtdContratos: 2, notionalUSD: 80000 },
  ])
  assert(r.length === 2, 'Resumo: 2 culturas', `got ${r.length}`)
  const soja = r.find((x) => x.cultura === 'soja')!
  assert(soja.qtdLong === 5 && soja.qtdShort === 3, 'Soja Long=5 Short=3')
  assert(soja.net === 2, 'Soja net=2')
  assert(approxEq(soja.netNotionalUSD, 140000, 0.001), 'Soja netNotional=140k')
}

console.log()
console.log(`Total: ${pass} pass / ${fail} fail`)
if (fail > 0) process.exit(1)
