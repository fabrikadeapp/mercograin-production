/**
 * Tests para lib/usda/esr-client.ts
 * Run: npx tsx lib/usda/esr-client.test.ts
 *
 * Testa apenas constantes e funções puras (sem rede): ESR_CODES e temChave().
 * Os códigos foram descobertos ao vivo em /esr/commodities (Soybeans=801,
 * Corn=401) durante o desenvolvimento; aqui apenas fixamos os valores.
 */
import { ESR_CODES, temChave } from './esr-client'

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

// ── ESR_CODES: códigos validados ao vivo ────────────────────────────────────
{
  assert(ESR_CODES.soja === 801, 'ESR_CODES.soja === 801 (Soybeans)', String(ESR_CODES.soja))
  assert(ESR_CODES.milho === 401, 'ESR_CODES.milho === 401 (Corn)', String(ESR_CODES.milho))
  assert(typeof ESR_CODES.soja === 'number', 'ESR_CODES.soja é number')
  assert(typeof ESR_CODES.milho === 'number', 'ESR_CODES.milho é number')
}

// ── temChave: reage ao ambiente ─────────────────────────────────────────────
{
  const original = process.env.USDA_API_KEY

  process.env.USDA_API_KEY = 'chave-de-teste'
  assert(temChave() === true, 'temChave() === true quando a chave está setada')

  delete process.env.USDA_API_KEY
  assert(temChave() === false, 'temChave() === false quando a chave está ausente')

  process.env.USDA_API_KEY = '   '
  assert(temChave() === false, 'temChave() === false quando a chave é só espaços')

  // Restaura o estado original do ambiente.
  if (original === undefined) delete process.env.USDA_API_KEY
  else process.env.USDA_API_KEY = original
}

// ── Resultado ───────────────────────────────────────────────────────────────
console.log(`\n${pass} passou, ${fail} falhou`)
if (fail > 0) process.exit(1)
