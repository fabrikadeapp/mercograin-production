/**
 * Tests para lib/cotacoes/historico.ts
 * Run: npx tsx lib/cotacoes/historico.test.ts
 */
import { mediaMovel, resumoSerie, periodoParaDias, type PontoHistorico } from './historico'

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

function approxEq(a: number | null, b: number | null, eps = 1e-6) {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  return Math.abs(a - b) < eps
}

console.log('historico.test.ts')

// 1. mediaMovel — janela menor que array
{
  const res = mediaMovel([10, 20, 30, 40, 50], 3)
  // [null, null, 20, 30, 40]
  assert(
    res.length === 5 &&
      res[0] === null &&
      res[1] === null &&
      approxEq(res[2], 20) &&
      approxEq(res[3], 30) &&
      approxEq(res[4], 40),
    'mediaMovel janela < tamanho',
    JSON.stringify(res),
  )
}

// 2. mediaMovel — janela igual ao array
{
  const res = mediaMovel([10, 20, 30, 40], 4)
  // [null, null, null, 25]
  assert(
    res.length === 4 &&
      res[0] === null &&
      res[1] === null &&
      res[2] === null &&
      approxEq(res[3], 25),
    'mediaMovel janela == tamanho',
    JSON.stringify(res),
  )
}

// 3. mediaMovel — janela maior (todos null)
{
  const res = mediaMovel([10, 20, 30], 5)
  assert(
    res.length === 3 && res.every((v) => v === null),
    'mediaMovel janela > tamanho retorna nulls',
    JSON.stringify(res),
  )
}

// 4. resumoSerie — vazia
{
  const r = resumoSerie([])
  assert(
    r.pontosTotais === 0 &&
      r.atual === null &&
      r.minimo === null &&
      r.maximo === null &&
      r.variacaoPct === null,
    'resumoSerie vazia retorna nulls',
  )
}

// 5. resumoSerie — valores reais
{
  const pts: PontoHistorico[] = [
    { data: '2026-01-01', preco: 100, dolarReal: null, volume: null },
    { data: '2026-01-02', preco: 110, dolarReal: null, volume: null },
    { data: '2026-01-03', preco: 90, dolarReal: null, volume: null },
    { data: '2026-01-04', preco: 120, dolarReal: null, volume: null },
  ]
  const r = resumoSerie(pts)
  // inicio=100, atual=120, var=20%, min=90, max=120, media=105
  assert(
    r.pontosTotais === 4 &&
      approxEq(r.inicio, 100) &&
      approxEq(r.atual, 120) &&
      approxEq(r.minimo, 90) &&
      approxEq(r.maximo, 120) &&
      approxEq(r.media, 105) &&
      approxEq(r.variacaoPct, 20),
    'resumoSerie valores reais',
    JSON.stringify(r),
  )
}

// 6. periodoParaDias — sanity
{
  assert(
    periodoParaDias('7d') === 7 &&
      periodoParaDias('30d') === 30 &&
      periodoParaDias('1y') === 365 &&
      periodoParaDias('all') === null,
    'periodoParaDias mapeamento',
  )
}

console.log(`\n${pass} pass, ${fail} fail`)
if (fail > 0) process.exit(1)
