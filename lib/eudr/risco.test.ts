/**
 * S5 M9 — Testes da avaliação de risco EUDR.
 * Executar: npx ts-node lib/eudr/risco.test.ts
 */
import { avaliarRisco, agregarRisco } from './risco'

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

console.log('# EUDR avaliarRisco')

// 1) tudo OK => baixo
const r1 = avaliarRisco({
  propriedade: { car: 'X', carStatus: 'ativo', embargoIbama: false, sobreposicaoTI: false, sobreposicaoUC: false, geoJson: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] }, alertaDesmatamento: [] },
})
assert(r1.nivel === 'baixo' && r1.fatores.length === 0, 'sem riscos => baixo')

// 2) embargo IBAMA => critico
const r2 = avaliarRisco({ propriedade: { embargoIbama: true, geoJson: {} } })
assert(r2.nivel === 'critico' && r2.fatores.some((f) => f.tipo === 'embargo_ibama'), 'embargo IBAMA => critico')

// 3) só sobreposicao TI => critico
const r3 = avaliarRisco({ propriedade: { sobreposicaoTI: true, geoJson: {} } })
assert(r3.nivel === 'critico', 'sobreposicao TI => critico')

// 4) UC sem TI => alto
const r4 = avaliarRisco({ propriedade: { sobreposicaoUC: true, geoJson: {} } })
assert(r4.nivel === 'alto', 'sobreposicao UC => alto')

// 5) CAR cancelado => alto
const r5 = avaliarRisco({ propriedade: { carStatus: 'cancelado', geoJson: {} } })
assert(r5.nivel === 'alto' && r5.fatores.some((f) => f.tipo === 'car_invalido'), 'CAR cancelado => alto')

// 6) sem geoJson => alto
const r6 = avaliarRisco({ propriedade: {} })
assert(r6.nivel === 'alto' && r6.fatores.some((f) => f.tipo === 'sem_geo'), 'sem geo => alto')

// 7) desmatamento recente => alto
const r7 = avaliarRisco({ propriedade: { geoJson: {}, alertaDesmatamento: [{ id: 1 }, { id: 2 }] } })
assert(r7.nivel === 'alto' && r7.fatores.some((f) => f.tipo === 'desmatamento_recente'), 'desmatamento => alto')

// 8) múltiplos: embargo + sem_geo => critico domina
const r8 = avaliarRisco({ propriedade: { embargoIbama: true, sobreposicaoUC: true } })
assert(r8.nivel === 'critico' && r8.fatores.length >= 2, 'multi-fatores critico domina')

// 9) agregação: pior nível domina
const agg = agregarRisco([r1, r4, r2])
assert(agg.nivel === 'critico', 'agregacao escolhe pior nivel')

console.log(`\nResultado: ${pass} PASS / ${fail} FAIL`)
if (fail > 0) process.exit(1)
