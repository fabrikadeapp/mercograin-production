/**
 * Tests para lib/historico/cot-client.ts (funções PURAS, sem rede).
 * Run: npx tsx lib/historico/cot-client.test.ts
 */
import { agregarMensal, zScoreNet, type CotPonto } from './cot-client'

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

function approxEq(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) < eps
}

function ponto(data: string, longs: number, shorts: number): CotPonto {
  const ano = Number(data.slice(0, 4))
  const mes = Number(data.slice(5, 7))
  return { data, ano, mes, longs, shorts, netManagedMoney: longs - shorts }
}

// ── 1) agregarMensal: média do net por mês (semanal → mensal) ───────────────
{
  // Jan/2024: 2 semanas com net 100 e 200 → média 150.
  // Fev/2024: 1 semana com net -50 → média -50.
  const pontos: CotPonto[] = [
    ponto('2024-01-05', 300, 200), // net 100
    ponto('2024-01-12', 400, 200), // net 200
    ponto('2024-02-02', 100, 150), // net -50
  ]
  const m = agregarMensal(pontos)
  assert(m.length === 2, 'dois meses distintos', JSON.stringify(m))
  assert(m[0].ano === 2024 && m[0].mes === 1, 'primeiro mês = jan/2024', JSON.stringify(m[0]))
  assert(approxEq(m[0].net, 150), 'média jan = 150', `${m[0].net}`)
  assert(m[1].ano === 2024 && m[1].mes === 2, 'segundo mês = fev/2024', JSON.stringify(m[1]))
  assert(approxEq(m[1].net, -50), 'média fev = -50', `${m[1].net}`)
}

// ── 2) agregarMensal: ordena ascendente por (ano, mes) ──────────────────────
{
  const pontos: CotPonto[] = [
    ponto('2024-03-01', 100, 0), // net 100
    ponto('2023-12-01', 50, 0), // net 50
    ponto('2024-01-01', 80, 0), // net 80
  ]
  const m = agregarMensal(pontos)
  assert(m.length === 3, 'três meses', JSON.stringify(m))
  assert(
    m[0].ano === 2023 && m[0].mes === 12 && m[1].mes === 1 && m[2].mes === 3,
    'ordenado asc: dez/23 → jan/24 → mar/24',
    JSON.stringify(m.map((x) => `${x.ano}-${x.mes}`)),
  )
}

// ── 3) agregarMensal: ignora net não-finito e lista vazia ───────────────────
{
  assert(agregarMensal([]).length === 0, 'lista vazia → []')
  const comNaN: CotPonto[] = [
    { data: '2024-01-05', ano: 2024, mes: 1, longs: 1, shorts: 1, netManagedMoney: NaN },
    ponto('2024-01-12', 200, 100), // net 100
  ]
  const m = agregarMensal(comNaN)
  assert(m.length === 1 && approxEq(m[0].net, 100), 'ignora net NaN, média = 100', JSON.stringify(m))
}

// ── 4) zScoreNet: normaliza (média 0, desvio 1) e detecta extremos ──────────
{
  // Série simétrica: média 0; valor mais extremo deve ter |z| maior.
  const serie = [10, 12, 11, 9, 50] // 50 é o extremo
  const z = zScoreNet(serie)
  assert(z.length === serie.length, 'preserva comprimento', `${z.length}`)
  // soma dos z ≈ 0 (propriedade do z-score)
  const soma = z.reduce((a, b) => a + b, 0)
  assert(approxEq(soma, 0, 1e-9), 'soma dos z-scores ≈ 0', `${soma}`)
  // o último (50) é o mais esticado e positivo
  const maxIdx = z.indexOf(Math.max(...z))
  assert(maxIdx === 4, 'extremo (50) tem o maior z', JSON.stringify(z))
  assert(z[4] > 1.5, 'posição esticada → |z| > 1.5', `${z[4]}`)
}

// ── 5) zScoreNet: desvio-padrão populacional conhecido ──────────────────────
{
  // [2,4,4,4,5,5,7,9]: média 5, desvio populacional 2 → z conhecidos.
  const serie = [2, 4, 4, 4, 5, 5, 7, 9]
  const z = zScoreNet(serie)
  assert(approxEq(z[0], -1.5), 'z(2) = -1.5 (média 5, desvio 2)', `${z[0]}`)
  assert(approxEq(z[7], 2.0), 'z(9) = 2.0', `${z[7]}`)
  assert(approxEq(z[4], 0), 'z(5) = 0 (na média)', `${z[4]}`)
}

// ── 6) zScoreNet: casos degenerados (vazio, constante) ──────────────────────
{
  assert(zScoreNet([]).length === 0, 'série vazia → []')
  const constante = zScoreNet([7, 7, 7])
  assert(
    constante.length === 3 && constante.every((v) => v === 0),
    'série constante (desvio 0) → zeros',
    JSON.stringify(constante),
  )
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
