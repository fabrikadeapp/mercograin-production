/**
 * Tests para lib/veredito/sinais.ts
 * Run: npx tsx lib/veredito/sinais.test.ts
 *
 * Sem data do sistema: todas as séries são sintéticas e passadas por parâmetro.
 * Determinístico — cada caso isola um comportamento da regra.
 */
import {
  aprenderSazonalidade,
  sinalSazonal,
  sinalMeanReversion,
  sinalMomentum,
  calcularVeredito,
  avaliarHistorico,
  vereditoAoVivo,
  type PontoVeredito,
} from './sinais'

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

function approxEq(a: number, b: number, eps = 1e-9) {
  return Math.abs(a - b) < eps
}

/** Constrói uma série a partir de preços (e opcionalmente cbot) começando jan/anoBase. */
function serieDe(precos: number[], cbots?: number[], anoBase = 2018): PontoVeredito[] {
  const out: PontoVeredito[] = []
  let ano = anoBase
  let mes = 1
  for (let i = 0; i < precos.length; i++) {
    out.push({ ano, mes, preco: precos[i], cbot: cbots ? cbots[i] : precos[i] })
    mes++
    if (mes > 12) {
      mes = 1
      ano++
    }
  }
  return out
}

// ── 1) aprenderSazonalidade: padrão conhecido por mês de origem (H=1) ─────────
{
  const alvo: Record<number, number> = {
    1: 0.05, 2: 0.04, 3: -0.03, 4: -0.06, 5: 0.02, 6: 0.01,
    7: -0.04, 8: -0.05, 9: 0.03, 10: 0.06, 11: -0.02, 12: 0.0,
  }
  const precos: number[] = []
  let preco = 100
  for (let ano = 2020; ano <= 2022; ano++) {
    for (let m = 1; m <= 12; m++) {
      precos.push(preco)
      preco = preco * (1 + alvo[m])
    }
  }
  const serie = serieDe(precos, undefined, 2020)
  const padroes = aprenderSazonalidade(serie, 1)
  let todos = true
  for (let m = 1; m <= 12; m++) {
    if (!approxEq(padroes[m], alvo[m], 1e-9)) {
      todos = false
      console.error(`    mês ${m}: esperado ${alvo[m]} obtido ${padroes[m]}`)
    }
  }
  assert(todos, 'aprenderSazonalidade recupera o retorno-alvo de cada mês (H=1)')
  assert(padroes[4] < padroes[1], 'mês de queda (4) < mês de alta (1)', `${padroes[4]} vs ${padroes[1]}`)
}

// ── 2) aprenderSazonalidade: H=2 e corte de futuro ───────────────────────────
{
  const serie = serieDe([100, 110, 121], undefined, 2021)
  const p2 = aprenderSazonalidade(serie, 2)
  assert(approxEq(p2[1], 0.21), 'H=2 jan = +21% (100→121)', `${p2[1]}`)
  assert(p2[2] === undefined, 'H=2 fev ausente (sem futuro)', `${p2[2]}`)
}

// ── 3) aprenderSazonalidade: robusto a preço zero/não-finito, nunca lança ─────
{
  const serie: PontoVeredito[] = [
    { ano: 2020, mes: 2, preco: 0, cbot: 1 }, // origem preço 0 → ignorada
    { ano: 2020, mes: 3, preco: 100, cbot: 1 },
    { ano: 2020, mes: 4, preco: 110, cbot: 1 },
  ]
  let lancou = false
  let p: Record<number, number> = {}
  try {
    p = aprenderSazonalidade(serie, 1)
  } catch {
    lancou = true
  }
  assert(!lancou, 'aprenderSazonalidade não lança com entradas inválidas')
  assert(p[2] === undefined, 'origem com preço 0 ausente', `${p[2]}`)
  assert(approxEq(p[3], 0.1), 'mês 3 origem válida → +10%', `${p[3]}`)
}

// ── 4) sinalSazonal: mês de queda → vender ───────────────────────────────────
{
  const serie = serieDe([100, 100, 100], undefined, 2021) // i=0 é mês 1 (jan)
  const padroes = { 1: -0.05, 2: 0.05, 3: 0.0 }
  const s = sinalSazonal(serie, 0, padroes, 2)
  assert(s.nome === 'sazonal', 'nome correto', s.nome)
  assert(s.direcao === 'vender', 'mês de queda → vender', s.direcao)
}

// ── 5) sinalSazonal: mês de alta → segurar; sem padrão → neutro ──────────────
{
  const serie = serieDe([100, 100, 100], undefined, 2021)
  const segura = sinalSazonal(serie, 1, { 2: 0.05 }, 2) // i=1 é fev
  assert(segura.direcao === 'segurar', 'mês de alta → segurar', segura.direcao)
  const neutro = sinalSazonal(serie, 2, { 1: -0.05 }, 2) // i=2 é mar, sem padrão
  assert(neutro.direcao === 'neutro', 'mês sem padrão → neutro', neutro.direcao)
}

// ── 6) sinalMeanReversion: muito acima da média 12m → vender ─────────────────
{
  // 12 meses a 100, depois um mês a 110 (+10% acima da média) → vender
  const precos = [...Array(12).fill(100), 110]
  const serie = serieDe(precos, undefined, 2018)
  const s = sinalMeanReversion(serie, 12)
  assert(s.nome === 'mean_reversion', 'nome correto', s.nome)
  assert(s.direcao === 'vender', 'preço +10% sobre média 12m → vender', s.direcao)
}

// ── 7) sinalMeanReversion: muito abaixo → segurar; perto → neutro ────────────
{
  const baixo = serieDe([...Array(12).fill(100), 90], undefined, 2018)
  assert(sinalMeanReversion(baixo, 12).direcao === 'segurar', 'preço -10% → segurar')

  const perto = serieDe([...Array(12).fill(100), 102], undefined, 2018) // +2% < 6%
  assert(sinalMeanReversion(perto, 12).direcao === 'neutro', 'preço +2% (dentro da banda) → neutro')

  const curto = serieDe([100, 100, 100], undefined, 2018) // i<12 → insuficiente
  assert(sinalMeanReversion(curto, 2).direcao === 'neutro', 'histórico curto → neutro')
}

// ── 8) sinalMomentum: CBOT em alta → segurar; baixa → vender; lateral → neutro ─
{
  const precos = Array(7).fill(100)
  const subindo = serieDe(precos, [100, 100, 100, 100, 100, 100, 110], 2018) // +10% em 6m
  const mAlta = sinalMomentum(subindo, 6)
  assert(mAlta.nome === 'momentum', 'nome correto', mAlta.nome)
  assert(mAlta.direcao === 'segurar', 'CBOT +10% em 6m → segurar', mAlta.direcao)

  const caindo = serieDe(precos, [100, 100, 100, 100, 100, 100, 90], 2018)
  assert(sinalMomentum(caindo, 6).direcao === 'vender', 'CBOT -10% em 6m → vender')

  const lateral = serieDe(precos, [100, 100, 100, 100, 100, 100, 102], 2018) // +2% < 4%
  assert(sinalMomentum(lateral, 6).direcao === 'neutro', 'CBOT +2% em 6m → neutro')
}

// ── 9) calcularVeredito: voto majoritário (2 vender, 1 segurar) → vender ──────
{
  // i=12: sazonal vender (padrão mês 1 negativo), MR vender (preço bem acima),
  // momentum segurar (CBOT subindo). Maioria = vender, concordância 2.
  const precos = [...Array(12).fill(100), 110] // i=12 é mês 1 (jan), +10% sobre média
  const cbots = [...Array(6).fill(100), 110, 110, 110, 110, 110, 110, 120] // CBOT subindo 6m
  const serie = serieDe(precos, cbots, 2018)
  const padroes = { 1: -0.05 } // jan historicamente cai
  const v = calcularVeredito(serie, 12, { H: 2, padroes })
  assert(v.direcao === 'vender', 'maioria vender (2/3)', v.direcao)
  assert(v.concordancia === 2, 'concordância = 2', `${v.concordancia}`)
  assert(v.confianca === 'media', 'concordância 2 → confiança media', v.confianca)
  assert(v.sinais.length === 3, 'sempre 3 sinais', `${v.sinais.length}`)
}

// ── 10) calcularVeredito: 3/3 concordância → confiança alta ──────────────────
{
  // sazonal vender + MR vender + momentum vender.
  const precos = [...Array(12).fill(100), 110]
  const cbots = [...Array(6).fill(100), 110, 110, 110, 110, 110, 110, 90] // CBOT caindo → vender
  const serie = serieDe(precos, cbots, 2018)
  const padroes = { 1: -0.05 }
  const v = calcularVeredito(serie, 12, { H: 2, padroes })
  assert(v.direcao === 'vender', '3/3 vender', v.direcao)
  assert(v.concordancia === 3, 'concordância = 3', `${v.concordancia}`)
  assert(v.confianca === 'alta', 'concordância 3 → confiança alta', v.confianca)
}

// ── 11) calcularVeredito: empate (1 vender, 1 segurar, 1 neutro) → neutro ─────
{
  // sazonal vender, MR segurar (preço abaixo), momentum neutro (CBOT lateral).
  const precos = [...Array(12).fill(100), 90] // -10% → MR segurar
  const cbots = [...Array(6).fill(100), 100, 100, 100, 100, 100, 100, 101] // lateral
  const serie = serieDe(precos, cbots, 2018)
  const padroes = { 1: -0.05 } // sazonal vender
  const v = calcularVeredito(serie, 12, { H: 2, padroes })
  assert(v.direcao === 'neutro', 'empate vender/segurar → neutro', v.direcao)
}

// ── 12) avaliarHistorico: série sintética com taxa conhecida (sazonal 100%) ──
{
  // Construo série onde o mês de janeiro SEMPRE cai nos H=1 meses seguintes e
  // todos os outros meses sobem de leve, de forma que o sinal sazonal acerte
  // 100% (cada mês acionável bate com o realizado).
  const precos: number[] = []
  let preco = 100
  for (let ano = 2010; ano <= 2025; ano++) {
    for (let m = 1; m <= 12; m++) {
      precos.push(preco)
      // jan cai 10% no próximo mês; demais sobem 5% — padrão perfeitamente separável
      const ret = m === 1 ? -0.1 : 0.05
      preco = preco * (1 + ret)
    }
  }
  const serie = serieDe(precos, undefined, 2010)
  const aval = avaliarHistorico(serie, 1)
  const saz = aval.porSinal.sazonal
  // jan tem média negativa → vende e acerta; demais média positiva → segura e acerta.
  assert(saz.taxa === 100, 'sazonal acerta 100% em série perfeitamente separável', `${saz.taxa}`)
  assert(saz.ganho === 50, 'ganho = taxa - 50 = 50', `${saz.ganho}`)
  assert(saz.n > 0, 'sazonal teve apostas (n>0)', `${saz.n}`)
}

// ── 13) avaliarHistorico: ganhoVsAcaso = taxa - 50 em todos os sinais ────────
{
  const precos: number[] = []
  let preco = 100
  for (let ano = 2010; ano <= 2024; ano++) {
    for (let m = 1; m <= 12; m++) {
      precos.push(preco)
      preco = preco * (1 + (m % 2 === 0 ? 0.03 : -0.02))
    }
  }
  const serie = serieDe(precos, undefined, 2010)
  const aval = avaliarHistorico(serie, 2)
  for (const nome of ['sazonal', 'mean_reversion', 'momentum']) {
    const t = aval.porSinal[nome]
    assert(approxEq(t.ganho, t.taxa - 50, 1e-6), `${nome}: ganho == taxa-50`, `${t.ganho} vs ${t.taxa - 50}`)
    assert(t.taxa >= 0 && t.taxa <= 100, `${nome}: taxa em [0,100]`, `${t.taxa}`)
  }
  assert(approxEq(aval.veredito.ganho, aval.veredito.taxa - 50, 1e-6), 'veredito: ganho == taxa-50')
}

// ── 14) vereditoAoVivo: usa o último mês e anexa taxas históricas ────────────
{
  const precos: number[] = []
  let preco = 100
  for (let ano = 2010; ano <= 2024; ano++) {
    for (let m = 1; m <= 12; m++) {
      precos.push(preco)
      preco = preco * (1 + (m === 1 ? -0.08 : 0.04))
    }
  }
  const serie = serieDe(precos, undefined, 2010)
  const v = vereditoAoVivo(serie, 1)
  assert(v.sinais.length === 3, 'aoVivo gera 3 sinais', `${v.sinais.length}`)
  // taxa histórica do sazonal deve ter sido anexada (>0) e bater com avaliarHistorico
  const aval = avaliarHistorico(serie, 1)
  const sazSinal = v.sinais.find((s) => s.nome === 'sazonal')!
  assert(approxEq(sazSinal.taxaHistorica, aval.porSinal.sazonal.taxa, 1e-6), 'taxa do sazonal anexada bate', `${sazSinal.taxaHistorica} vs ${aval.porSinal.sazonal.taxa}`)
  assert(approxEq(sazSinal.ganhoVsAcaso, sazSinal.taxaHistorica - 50, 1e-6), 'ganhoVsAcaso anexado = taxa-50')
  assert(approxEq(v.taxaHistorica, aval.veredito.taxa, 1e-6), 'taxa do veredito anexada bate', `${v.taxaHistorica} vs ${aval.veredito.taxa}`)
}

// ── 15) vereditoAoVivo: série vazia → neutro defensivo, nunca lança ──────────
{
  let lancou = false
  let v
  try {
    v = vereditoAoVivo([], 2)
  } catch {
    lancou = true
  }
  assert(!lancou, 'vereditoAoVivo não lança com série vazia')
  assert(v !== undefined && v.direcao === 'neutro', 'série vazia → veredito neutro', v?.direcao)
  assert(v !== undefined && v.sinais.length === 0, 'série vazia → sem sinais', `${v?.sinais.length}`)
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
