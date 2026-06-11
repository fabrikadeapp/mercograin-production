/**
 * Tests para lib/usda/psd-client.ts
 * Run: npx tsx lib/usda/psd-client.test.ts
 *
 * NÃO bate na API real (sem rede garantida no CI). Testa apenas constantes e
 * funções puras (USDA_CODES, ATTR, PAIS, temChave com env mockada).
 */
import { USDA_CODES, ATTR, PAIS, temChave, type PsdRegistro } from './psd-client'

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

// ── Códigos de commodity validados ──────────────────────────────────────────
assert(USDA_CODES.soja === '2222000', "USDA_CODES.soja = '2222000'", USDA_CODES.soja)
assert(USDA_CODES.milho === '0440000', "USDA_CODES.milho = '0440000'", USDA_CODES.milho)

// ── Atributos PSD validados ─────────────────────────────────────────────────
assert(ATTR.producao === 28, 'ATTR.producao = 28 (Production)', `${ATTR.producao}`)
assert(ATTR.estoqueFinal === 176, 'ATTR.estoqueFinal = 176 (Ending Stocks)', `${ATTR.estoqueFinal}`)
assert(ATTR.produtividade === 184, 'ATTR.produtividade = 184 (Yield)', `${ATTR.produtividade}`)

// ── Códigos de país ─────────────────────────────────────────────────────────
assert(PAIS.brasil === 'BR', "PAIS.brasil = 'BR'", PAIS.brasil)
assert(PAIS.argentina === 'AR', "PAIS.argentina = 'AR'", PAIS.argentina)
assert(PAIS.eua === 'US', "PAIS.eua = 'US'", PAIS.eua)

// ── temChave: reflete a presença de USDA_API_KEY no ambiente ─────────────────
const chaveOriginal = process.env.USDA_API_KEY

// Sem chave
delete process.env.USDA_API_KEY
assert(temChave() === false, 'temChave() = false quando USDA_API_KEY ausente')

// Chave em branco também conta como ausente
process.env.USDA_API_KEY = '   '
assert(temChave() === false, 'temChave() = false quando chave só tem espaços')

// Com chave válida
process.env.USDA_API_KEY = 'chave-de-teste-123'
assert(temChave() === true, 'temChave() = true quando USDA_API_KEY presente')

// Restaura o ambiente
if (chaveOriginal === undefined) delete process.env.USDA_API_KEY
else process.env.USDA_API_KEY = chaveOriginal

// ── Sanidade de tipos: PsdRegistro aceita os campos esperados ───────────────
{
  const reg: PsdRegistro = {
    commodityCode: '2222000',
    countryCode: 'WL',
    marketYear: 2026,
    month: 6,
    attributeId: 176,
    value: 124883,
    unitId: 8,
  }
  // value em mil toneladas → /1000 = Mt (bate com referência: 124,9 Mt)
  assert(Math.abs(reg.value / 1000 - 124.883) < 1e-6, 'PsdRegistro: value/1000 = 124,883 Mt', `${reg.value / 1000}`)
}

// ── Resumo ──────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
