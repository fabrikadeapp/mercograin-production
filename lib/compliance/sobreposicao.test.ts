/**
 * S5 M9 — Testes puros de cálculo de bbox/sobreposição.
 * Executar: npx ts-node lib/compliance/sobreposicao.test.ts
 *
 * Testa apenas funções puras (calcularBbox + helpers internos via export
 * indireto). A função verificarSobreposicao tem dependências externas (DB,
 * Redis) e fica coberta por testes de integração futuros.
 */
import { calcularBbox, bboxOverlap, bboxOverlapPct } from './geo-bbox'

let pass = 0
let fail = 0

function assert(cond: boolean, label: string) {
  if (cond) {
    pass++
    console.log('  PASS:', label)
  } else {
    fail++
    console.error('  FAIL:', label)
  }
}

console.log('# sobreposicao.calcularBbox')

// 1) Polygon simples
const poly = { type: 'Polygon', coordinates: [[[-54, -25], [-53, -25], [-53, -24], [-54, -24], [-54, -25]]] }
const bb1 = calcularBbox(poly)
assert(
  !!bb1 && bb1[0] === -54 && bb1[1] === -25 && bb1[2] === -53 && bb1[3] === -24,
  'Polygon => bbox correto',
)

// 2) Feature wrapper
const feat = { type: 'Feature', geometry: poly, properties: {} }
const bb2 = calcularBbox(feat)
assert(!!bb2 && bb2[0] === -54, 'Feature wrapper aceito')

// 3) MultiPolygon
const multi = {
  type: 'MultiPolygon',
  coordinates: [
    [[[-50, -10], [-49, -10], [-49, -9], [-50, -9], [-50, -10]]],
    [[[-48, -8], [-47, -8], [-47, -7], [-48, -7], [-48, -8]]],
  ],
}
const bb3 = calcularBbox(multi)
assert(!!bb3 && bb3[0] === -50 && bb3[2] === -47 && bb3[1] === -10 && bb3[3] === -7, 'MultiPolygon => bbox que envolve tudo')

// 4) null/undefined
assert(calcularBbox(null) === null, 'null => null')
assert(calcularBbox(undefined) === null, 'undefined => null')

// 5) sem coordinates
assert(calcularBbox({ type: 'Polygon' } as any) === null, 'sem coordinates => null')

// 6) coordinates inválido
assert(calcularBbox({ type: 'Polygon', coordinates: [] }) === null, 'coordinates vazio => null')

// 7) bboxOverlap true
assert(bboxOverlap([0, 0, 2, 2], [1, 1, 3, 3]) === true, 'bboxes sobrepostos => true')

// 8) bboxOverlap false
assert(bboxOverlap([0, 0, 1, 1], [2, 2, 3, 3]) === false, 'bboxes disjuntos => false')

// 9) overlapPct exato 25%
const pct = bboxOverlapPct([0, 0, 2, 2], [1, 1, 3, 3])
assert(Math.abs(pct - 25) < 0.01, `25% overlap (got ${pct})`)

console.log(`\nResultado: ${pass} PASS / ${fail} FAIL`)
if (fail > 0) process.exit(1)
