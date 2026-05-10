/**
 * Tests para lib/risco/limites — classificarSeveridade
 * Run: npx tsx lib/risco/limites.test.ts
 */
import { classificarSeveridade } from './limites'

let pass = 0
let fail = 0
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('limites.test.ts')

// Test 1: ainda OK (< aviso)
{
  const r = classificarSeveridade(50, 100, 80)
  assert(r.severidade === null, 'valor 50/100: OK (sem breach)', `got ${r.severidade}`)
}

// Test 2: aviso (>= 80, < 100)
{
  const r = classificarSeveridade(85, 100, 80)
  assert(r.severidade === 'aviso', 'valor 85/100 (aviso=80): severidade=aviso', `got ${r.severidade}`)
}

// Test 3: breach (>= máximo)
{
  const r = classificarSeveridade(105, 100, 80)
  assert(r.severidade === 'breach', 'valor 105/100: breach', `got ${r.severidade}`)
  assert(Math.abs(r.excedidoPct - 5) < 0.01, 'excedidoPct = 5%', `got ${r.excedidoPct}`)
}

// Test 4: critico (>= 120%)
{
  const r = classificarSeveridade(125, 100, 80)
  assert(r.severidade === 'critico', 'valor 125/100: critico', `got ${r.severidade}`)
  assert(Math.abs(r.excedidoPct - 25) < 0.01, 'excedidoPct = 25%', `got ${r.excedidoPct}`)
}

// Test 5: limite 0 não classifica
{
  const r = classificarSeveridade(50, 0, 0)
  assert(r.severidade === null, 'limite 0 → null', `got ${r.severidade}`)
}

// Test 6: borda — exatamente no aviso
{
  const r = classificarSeveridade(80, 100, 80)
  assert(r.severidade === 'aviso', 'borda aviso = 80 → aviso', `got ${r.severidade}`)
}

// Test 7: borda — exatamente no máximo
{
  const r = classificarSeveridade(100, 100, 80)
  assert(r.severidade === 'breach', 'borda máximo = 100 → breach', `got ${r.severidade}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
