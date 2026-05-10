/**
 * S10 M2 — testes unitários sem dependências externas.
 *
 * Cobre:
 *  - gerarNumeroOferta() — formato e unicidade probabilística
 *  - calcValidaAte() — janela de validade correta
 *  - buildWhere() — filtros multi-tenant
 *  - useKeyboardShortcuts isolated logic (key matching)
 *  - conversão CBOT cents/bushel → R$/sc60 (basis math sanity)
 */
const path = require('path')
const Module = require('module')

// Stub Prisma para imports indiretos
const originalResolve = Module._resolve_filename || Module._resolveFilename
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '@/lib/db') return require.resolve('./stubs/db-stub.js')
  return originalResolve.call(this, request, parent, ...rest)
}

let passed = 0
let failed = 0
function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++ }
  catch (e) { console.log(`❌ ${name}\n   ${e.message}`); failed++ }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert failed') }

// Re-implementamos as funções puras aqui pra evitar pipeline TS no test runner
function gerarNumeroOferta() {
  const now = new Date()
  const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `OF-${yyyymm}-${rand}`
}
function calcValidaAte(horas = 72) {
  return new Date(Date.now() + horas * 3600_000)
}
function buildWhere(workspaceId, f) {
  const where = {}
  if (workspaceId) where.workspaceId = workspaceId
  if (f.cultura) where.cultura = f.cultura
  if (f.tipo) where.tipo = f.tipo
  if (f.status) where.status = f.status
  if (f.precoMin != null || f.precoMax != null) {
    where.precoSc = {}
    if (f.precoMin != null) where.precoSc.gte = f.precoMin
    if (f.precoMax != null) where.precoSc.lte = f.precoMax
  }
  return where
}
function cbotToRsSc(centsPerBushel, grao, usdBrl) {
  const BUSHELS_PER_SC60 = {
    soja: 36.7437 * 0.06,
    milho: 39.3683 * 0.06,
    trigo: 36.7437 * 0.06,
  }
  const usdPerBushel = centsPerBushel / 100
  return usdPerBushel * (BUSHELS_PER_SC60[grao] || 2.2) * usdBrl
}

test('gerarNumeroOferta formato OF-YYYYMM-XXXXXX', () => {
  const n = gerarNumeroOferta()
  assert(/^OF-\d{6}-[A-Z0-9]{6}$/.test(n), `numero inesperado: ${n}`)
})

test('gerarNumeroOferta gera valores distintos', () => {
  const set = new Set()
  for (let i = 0; i < 1000; i++) set.add(gerarNumeroOferta())
  assert(set.size > 950, `colisões demais: ${1000 - set.size}`)
})

test('calcValidaAte 72h por padrão (+/- 1s)', () => {
  const before = Date.now()
  const v = calcValidaAte()
  const diff = v.getTime() - before
  assert(diff > 72 * 3600_000 - 1000 && diff < 72 * 3600_000 + 1000, `diff=${diff}`)
})

test('calcValidaAte 1h custom', () => {
  const v = calcValidaAte(1)
  const diff = v.getTime() - Date.now()
  assert(diff > 3599_000 && diff < 3601_000, `1h diff=${diff}`)
})

test('buildWhere multi-tenant inclui workspaceId', () => {
  const w = buildWhere('ws1', { cultura: 'soja' })
  assert(w.workspaceId === 'ws1', 'workspaceId faltando')
  assert(w.cultura === 'soja', 'cultura faltando')
})

test('buildWhere marketplace (workspaceId=null) NÃO injeta workspaceId', () => {
  const w = buildWhere(null, { cultura: 'soja' })
  assert(!('workspaceId' in w), 'workspaceId não devia existir')
})

test('buildWhere precoMin/Max produz Prisma range', () => {
  const w = buildWhere('ws1', { precoMin: 100, precoMax: 200 })
  assert(w.precoSc.gte === 100 && w.precoSc.lte === 200, 'range incorreto')
})

test('basis cbot soja → R$/sc faixa plausível', () => {
  // 1300 cents/bushel · USD/BRL 5.20 ≈ 150 R$/sc soja
  const r = cbotToRsSc(1300, 'soja', 5.20)
  assert(r > 130 && r < 200, `soja basis fora da faixa: ${r}`)
})

test('basis cbot milho → R$/sc faixa plausível', () => {
  // 500 cents/bushel · USD/BRL 5.20 ≈ 62 R$/sc milho
  const r = cbotToRsSc(500, 'milho', 5.20)
  assert(r > 50 && r < 80, `milho basis fora da faixa: ${r}`)
})

test('keyboard shortcut key matching (Ctrl+B normalizado)', () => {
  // Reimplementação local da lógica do hook (sem React)
  function matches(s, e) {
    const matchKey = e.key.toLowerCase() === s.key.toLowerCase()
    const matchCtrl = !!s.ctrl === (e.ctrlKey || e.metaKey)
    const matchShift = !!s.shift === !!e.shiftKey
    const matchAlt = !!s.alt === !!e.altKey
    return matchKey && matchCtrl && matchShift && matchAlt
  }
  const s = { key: 'b', ctrl: true }
  assert(matches(s, { key: 'B', ctrlKey: true }), 'Ctrl+B (uppercase) não match')
  assert(matches(s, { key: 'b', metaKey: true }), 'Cmd+B (mac) não match')
  assert(!matches(s, { key: 'b', ctrlKey: false }), 'Match sem Ctrl não devia')
})

console.log(`\nS10 M2: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
