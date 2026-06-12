/**
 * Tests para lib/backtest/sazonalidade.ts
 * Run: npx tsx lib/backtest/sazonalidade.test.ts
 *
 * Sem data do sistema: todas as séries são sintéticas e passadas por parâmetro.
 */
import {
  retornoMedioPorMes,
  vieSazonal,
  NORMALIZADOR_SAZONAL,
  SAZONALIDADE_SOJA,
  SAZONALIDADE_MILHO,
} from './sazonalidade'

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

function mm(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`
}

// ── 1) retornoMedioPorMes: padrão conhecido (sobe no 1º sem., cai no 2º) ─────
{
  // Série sintética determinística: o preço de cada mês = base * fator do mês.
  // Construímos para que o retorno H=1 de cada mês seja EXATAMENTE conhecido.
  // fator por mês calendário (multiplicador aplicado ao mês seguinte):
  //   jan→fev +10%, fev→mar +10% (1º semestre sobe), jul→ago -10% (2º cai)...
  // Para isolar: usamos retornos constantes por mês de origem ao longo de anos.
  const serie: { mes: string; precoFisico: number }[] = []
  // Defino retorno-alvo de H=1 por mês de ORIGEM (1..12):
  const alvo: Record<number, number> = {
    1: 0.05,
    2: 0.04,
    3: -0.03,
    4: -0.06,
    5: 0.02,
    6: 0.01,
    7: -0.04,
    8: -0.05,
    9: 0.03,
    10: 0.06,
    11: -0.02,
    12: 0.0,
  }
  // Gera 3 anos. preço[m+1] = preço[m] * (1 + alvo[mesDeOrigem]).
  let preco = 100
  for (let ano = 2020; ano <= 2022; ano++) {
    for (let m = 1; m <= 12; m++) {
      serie.push({ mes: mm(ano, m), precoFisico: preco })
      preco = preco * (1 + alvo[m])
    }
  }
  // último ponto (sem futuro) não importa para H=1; já está coberto pelo loop.

  const padroes = retornoMedioPorMes(serie, 1)
  // Cada mês de origem deve recuperar exatamente seu retorno-alvo (constante).
  let todosBatem = true
  for (let m = 1; m <= 12; m++) {
    if (!approxEq(padroes[m], alvo[m], 1e-9)) {
      todosBatem = false
      console.error(`    mês ${m}: esperado ${alvo[m]} obtido ${padroes[m]}`)
    }
  }
  assert(todosBatem, 'retornoMedioPorMes recupera o retorno-alvo de cada mês (H=1)')
  // mês 4 (colheita BR) é o mais negativo da série sintética
  assert(padroes[4] < padroes[1], 'mês de queda (4) < mês de alta (1)', `${padroes[4]} vs ${padroes[1]}`)
}

// ── 2) retornoMedioPorMes: H respeita corte (não vaza futuro além da série) ──
{
  const serie = [
    { mes: '2021-01', precoFisico: 100 },
    { mes: '2021-02', precoFisico: 110 },
    { mes: '2021-03', precoFisico: 121 },
  ]
  // H=1 → pares (01→02)=+10%, (02→03)=+10%. Mês 03 sem futuro → não conta.
  const p1 = retornoMedioPorMes(serie, 1)
  assert(approxEq(p1[1], 0.1), 'H=1 mês jan = +10%', `${p1[1]}`)
  assert(approxEq(p1[2], 0.1), 'H=1 mês fev = +10%', `${p1[2]}`)
  assert(p1[3] === undefined, 'mês mar sem futuro → ausente', `${p1[3]}`)
  // H=2 → só (01→03) = +21%. fev e mar sem H=2 disponível.
  const p2 = retornoMedioPorMes(serie, 2)
  assert(approxEq(p2[1], 0.21), 'H=2 mês jan = +21%', `${p2[1]}`)
  assert(p2[2] === undefined, 'H=2 mês fev ausente (sem futuro)', `${p2[2]}`)
}

// ── 3) retornoMedioPorMes: média de múltiplas observações do mesmo mês ───────
{
  // Dois anos, mês de janeiro com retornos +10% e -10% → média 0.
  const serie = [
    { mes: '2020-01', precoFisico: 100 },
    { mes: '2020-02', precoFisico: 110 }, // jan 2020 → +10%
    { mes: '2021-01', precoFisico: 100 },
    { mes: '2021-02', precoFisico: 90 }, // jan 2021 → -10%
  ]
  const p = retornoMedioPorMes(serie, 1)
  assert(approxEq(p[1], 0), 'média jan (+10% e -10%) = 0', `${p[1]}`)
}

// ── 4) retornoMedioPorMes: robusto a meses inválidos / preço zero ────────────
{
  const serie = [
    { mes: '2020-13', precoFisico: 100 }, // mês inválido → ignorado como origem
    { mes: '2020-02', precoFisico: 0 }, // preço zero como origem → ignorado
    { mes: '2020-03', precoFisico: 100 },
    { mes: 'lixo', precoFisico: 110 },
    { mes: '2020-05', precoFisico: 121 },
  ]
  // Não deve lançar; deve produzir um Record (possivelmente parcial).
  let lancou = false
  let p: Record<number, number> = {}
  try {
    p = retornoMedioPorMes(serie, 1)
  } catch {
    lancou = true
  }
  assert(!lancou, 'não lança com entradas inválidas')
  // mês 13 e preço 0 não devem gerar chaves
  assert(p[13] === undefined, 'mês inválido (13) ausente', `${p[13]}`)
  assert(p[2] === undefined, 'origem com preço 0 ausente', `${p[2]}`)
  // mês 3 (origem 100 → futuro 110 [string lixo? não]) — futuro é 'lixo'/110:
  // origem=2020-03 (100), futuro=índice 3 ('lixo',110) → ret +10% válido.
  assert(approxEq(p[3], 0.1), 'mês 3 origem válida → +10%', `${p[3]}`)
}

// ── 5) vieSazonal: retorno negativo → vender (direcao < 0) ───────────────────
{
  const padroes = { 3: -0.05, 8: 0.05, 6: 0.0 }
  const v3 = vieSazonal(3, padroes)
  assert(v3.direcao < 0, 'mês de queda → direcao negativa (vender)', `${v3.direcao}`)
  assert(approxEq(v3.direcao, -1), 'retorno -5% satura em -1', `${v3.direcao}`)
  assert(approxEq(v3.forca, 1), 'forca = |direcao| = 1', `${v3.forca}`)

  const v8 = vieSazonal(8, padroes)
  assert(v8.direcao > 0, 'mês de alta → direcao positiva (segurar)', `${v8.direcao}`)
  assert(approxEq(v8.direcao, 1), 'retorno +5% satura em +1', `${v8.direcao}`)

  const v6 = vieSazonal(6, padroes)
  assert(approxEq(v6.direcao, 0), 'retorno 0 → neutro', `${v6.direcao}`)
  assert(approxEq(v6.forca, 0), 'forca 0 quando neutro', `${v6.forca}`)
}

// ── 6) vieSazonal: normalização proporcional abaixo da saturação ────────────
{
  // metade do normalizador → direcao = 0.5
  const meio = NORMALIZADOR_SAZONAL / 2
  const v = vieSazonal(1, { 1: meio })
  assert(approxEq(v.direcao, 0.5), 'retorno = norm/2 → direcao 0.5', `${v.direcao}`)
  assert(approxEq(v.forca, 0.5), 'forca 0.5', `${v.forca}`)
  // negativo análogo
  const vn = vieSazonal(1, { 1: -meio })
  assert(approxEq(vn.direcao, -0.5), 'retorno = -norm/2 → direcao -0.5', `${vn.direcao}`)
}

// ── 7) vieSazonal: mês sem padrão → neutro, nunca inventa direção ────────────
{
  const v = vieSazonal(7, { 1: 0.05 }) // mês 7 ausente
  assert(approxEq(v.direcao, 0), 'mês ausente → direcao 0', `${v.direcao}`)
  assert(approxEq(v.forca, 0), 'mês ausente → forca 0', `${v.forca}`)
  // NaN no padrão → tratado como neutro
  const vNaN = vieSazonal(1, { 1: Number.NaN })
  assert(approxEq(vNaN.direcao, 0), 'padrão NaN → neutro', `${vNaN.direcao}`)
}

// ── 8) SAZONALIDADE_SOJA: coerente com 'vender antes de julho' ──────────────
{
  // Todos os 12 meses presentes
  for (let m = 1; m <= 12; m++) {
    assert(typeof SAZONALIDADE_SOJA[m] === 'number', `SOJA tem mês ${m}`, `${SAZONALIDADE_SOJA[m]}`)
  }
  // Colheita BR (fev–jun) com viés de queda (negativo) → vender antes de julho
  for (const m of [2, 3, 4, 5, 6]) {
    const v = vieSazonal(m, SAZONALIDADE_SOJA)
    assert(v.direcao < 0, `SOJA mês ${m} (pré-julho) → vender (direcao<0)`, `${v.direcao}`)
  }
  // Fim de inverno / entressafra (ago–set) firme → segurar (positivo)
  for (const m of [8, 9]) {
    const v = vieSazonal(m, SAZONALIDADE_SOJA)
    assert(v.direcao > 0, `SOJA mês ${m} (entressafra) → segurar (direcao>0)`, `${v.direcao}`)
  }
  // Pico de colheita (mar) é o mês mais baixista
  const minMes = Object.entries(SAZONALIDADE_SOJA).reduce((acc, [k, val]) =>
    val < acc.val ? { k: Number(k), val } : acc,
  { k: 0, val: Infinity })
  assert([3, 4].includes(minMes.k), 'SOJA mês mais baixista é colheita (mar/abr)', `${minMes.k}`)
}

// ── 9) SAZONALIDADE_MILHO: safrinha (jun–ago) baixista ──────────────────────
{
  for (let m = 1; m <= 12; m++) {
    assert(typeof SAZONALIDADE_MILHO[m] === 'number', `MILHO tem mês ${m}`, `${SAZONALIDADE_MILHO[m]}`)
  }
  // Colheita safrinha (jun–ago) com viés de queda
  for (const m of [6, 7, 8]) {
    const v = vieSazonal(m, SAZONALIDADE_MILHO)
    assert(v.direcao < 0, `MILHO mês ${m} (safrinha) → vender (direcao<0)`, `${v.direcao}`)
  }
  // Entressafra fim/início de ano (nov–dez–jan) firme
  for (const m of [11, 12, 1]) {
    const v = vieSazonal(m, SAZONALIDADE_MILHO)
    assert(v.direcao > 0, `MILHO mês ${m} (entressafra) → segurar (direcao>0)`, `${v.direcao}`)
  }
}

// ── 10) integração: padrões derivados da série batem com vieSazonal ─────────
{
  // Série sintética onde março cai (-5%) e agosto sobe (+5%) consistentemente.
  const serie: { mes: string; precoFisico: number }[] = []
  let preco = 100
  for (let ano = 2018; ano <= 2022; ano++) {
    for (let m = 1; m <= 12; m++) {
      serie.push({ mes: mm(ano, m), precoFisico: preco })
      const ret = m === 3 ? -0.05 : m === 8 ? 0.05 : 0.0
      preco = preco * (1 + ret)
    }
  }
  const padroes = retornoMedioPorMes(serie, 1)
  const vMar = vieSazonal(3, padroes)
  const vAgo = vieSazonal(8, padroes)
  assert(vMar.direcao < 0 && approxEq(vMar.direcao, -1), 'série: março → vender saturado', `${vMar.direcao}`)
  assert(vAgo.direcao > 0 && approxEq(vAgo.direcao, 1), 'série: agosto → segurar saturado', `${vAgo.direcao}`)
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
