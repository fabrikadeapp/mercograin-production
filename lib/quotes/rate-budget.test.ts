/**
 * Tests para lib/quotes/rate-budget.ts
 * Foco: função pura atingiu80pct (regra de teto de 80%).
 * Run: npx tsx lib/quotes/rate-budget.test.ts
 */
import { atingiu80pct } from './rate-budget'

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

// ── Twelve Data diário: 800 × 0,8 = 640 ─────────────────────────────────────
assert(atingiu80pct(640, 800) === true, 'twelvedata/dia: 640 atinge o teto (>=640)', '640/800')
assert(atingiu80pct(641, 800) === true, 'twelvedata/dia: 641 ultrapassa o teto')
assert(atingiu80pct(639, 800) === false, 'twelvedata/dia: 639 ainda permite consultar')
assert(atingiu80pct(0, 800) === false, 'twelvedata/dia: 0 consumido permite consultar')

// ── Twelve Data por minuto: 8 × 0,8 = 6,4 → floor 6 ─────────────────────────
assert(atingiu80pct(6, 8) === true, 'twelvedata/min: 6 atinge o teto (floor(6,4)=6)', '6/8')
assert(atingiu80pct(5, 8) === false, 'twelvedata/min: 5 ainda permite')
assert(atingiu80pct(7, 8) === true, 'twelvedata/min: 7 ultrapassa')

// ── pct customizado ─────────────────────────────────────────────────────────
assert(atingiu80pct(50, 100, 0.5) === true, 'pct 0,5: 50/100 atinge', '50 >= 50')
assert(atingiu80pct(49, 100, 0.5) === false, 'pct 0,5: 49/100 não atinge')
assert(atingiu80pct(99, 100, 1) === false, 'pct 1,0: 99/100 não atinge')
assert(atingiu80pct(100, 100, 1) === true, 'pct 1,0: 100/100 atinge')

// ── pct inválido cai para padrão 0,8 ────────────────────────────────────────
assert(atingiu80pct(640, 800, 0) === true, 'pct 0 inválido → usa 0,8 (640 atinge)', '640/800')
assert(atingiu80pct(639, 800, 0) === false, 'pct 0 inválido → usa 0,8 (639 não atinge)')

// ── teto inválido (<=0) bloqueia por segurança ──────────────────────────────
assert(atingiu80pct(0, 0) === true, 'teto 0 → sempre bloqueia (true)')
assert(atingiu80pct(0, -5) === true, 'teto negativo → sempre bloqueia (true)')

// ── arredondamento por floor em fração quebrada ─────────────────────────────
// 10 × 0,8 = 8 → 8 atinge, 7 não
assert(atingiu80pct(8, 10) === true, 'floor: 8/10 atinge (teto 8)')
assert(atingiu80pct(7, 10) === false, 'floor: 7/10 não atinge')
// 7 × 0,8 = 5,6 → floor 5
assert(atingiu80pct(5, 7) === true, 'floor: 5/7 atinge (floor(5,6)=5)')
assert(atingiu80pct(4, 7) === false, 'floor: 4/7 não atinge')

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
