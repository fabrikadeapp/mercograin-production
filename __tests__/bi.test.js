/**
 * S11 M8 — BI test suite.
 * Testa funções puras de cálculo dos KPIs sem precisar do Prisma real.
 * Reimplementa a lógica determinística pra rodar no node test runner do projeto.
 */
let passed = 0
let failed = 0
function test(name, fn) {
  try { fn(); console.log(`OK ${name}`); passed++ }
  catch (e) { console.log(`FAIL ${name}\n   ${e.message}`); failed++ }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert failed') }
function close(a, b, eps = 0.001) { return Math.abs(a - b) <= eps }

// ============================================================================
// Reimplementações puras das fórmulas validadas em lib/bi/*
// (mantenha em paralelo com as libs — qualquer mudança lá replica aqui)
// ============================================================================

function volumeContratadoToneladas(propostas) {
  let sacas = 0
  for (const p of propostas) {
    const arr = Array.isArray(p.graos) ? p.graos : []
    for (const g of arr) {
      sacas += Number(g?.quantidadeSc ?? g?.quantidade ?? 0)
    }
  }
  return sacas * 0.06
}

function volumeEntregueToneladas(tickets) {
  return tickets.reduce((s, t) => s + Number(t.pesoLiquidoKg || 0), 0) / 1000
}

function ebitda(receita, despesa) {
  return receita - despesa
}

function ebitdaMargem(receita, despesa) {
  if (receita <= 0) return 0
  return ((receita - despesa) / receita) * 100
}

function roicProxy(ebitdaValue, capitalGiro) {
  if (capitalGiro > 0) return (ebitdaValue / capitalGiro) * 100
  return ebitdaValue > 0 ? 100 : 0
}

function shareRegionalFromContratos(contratos) {
  const ufRe = /\b([A-Z]{2})\b/
  const acc = {}
  for (const c of contratos) {
    const m = c.endereco && c.endereco.match(ufRe)
    if (m) acc[m[1]] = (acc[m[1]] || 0) + 1
  }
  const total = Object.values(acc).reduce((s, n) => s + n, 0) || 1
  const out = {}
  for (const [uf, n] of Object.entries(acc)) {
    out[uf] = Math.round((n / total) * 1000) / 10
  }
  return out
}

function hitRate(enviadas, aceitas) {
  if (enviadas <= 0) return 0
  return (aceitas / enviadas) * 100
}

function tempoMedioFechamento(contratos) {
  let total = 0, n = 0
  for (const c of contratos) {
    if (c.propostaCriadaEm && c.criadoEm) {
      const ms = new Date(c.criadoEm) - new Date(c.propostaCriadaEm)
      if (ms > 0) { total += ms / 86400000; n++ }
    }
  }
  return n > 0 ? total / n : 0
}

function pontualidadeBoletos(boletos) {
  const pagos = boletos.filter((b) => b.confirmadoEm)
  if (pagos.length === 0) return 0
  let emDia = 0
  for (const b of pagos) {
    if (new Date(b.confirmadoEm) <= new Date(b.vencimento)) emDia++
  }
  return (emDia / pagos.length) * 100
}

function mediana(arr) {
  if (arr.length === 0) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

function rankByDesc(stats, key, targetId) {
  const sorted = [...stats].sort((a, b) => b[key] - a[key])
  const idx = sorted.findIndex((s) => s.id === targetId)
  return idx >= 0 ? idx + 1 : null
}

// ============================================================================
// Testes
// ============================================================================

test('volumeContratadoToneladas — soma sacas × 0.06', () => {
  const propostas = [
    { graos: [{ grao: 'soja', quantidadeSc: 1000 }, { grao: 'milho', quantidadeSc: 500 }] },
    { graos: [{ grao: 'soja', quantidade: 200 }] }, // fallback campo legado
  ]
  const t = volumeContratadoToneladas(propostas)
  assert(close(t, 1700 * 0.06), `esperado ${1700 * 0.06}, got ${t}`)
})

test('volumeEntregueToneladas — converte kg → t', () => {
  const tickets = [{ pesoLiquidoKg: 30000 }, { pesoLiquidoKg: 12000 }, { pesoLiquidoKg: 0 }]
  assert(close(volumeEntregueToneladas(tickets), 42), 'esperado 42t')
})

test('ebitda + margem com receita zero (sem divisão por zero)', () => {
  assert(ebitda(0, 100) === -100, 'ebitda negativo')
  assert(ebitdaMargem(0, 100) === 0, 'margem sem receita = 0 (proxy)')
})

test('ebitdaMargem 25% quando receita 1000 / despesa 750', () => {
  assert(close(ebitdaMargem(1000, 750), 25), 'margem incorreta')
})

test('ROIC proxy cai pra 100% quando capital giro = 0 e ebitda > 0', () => {
  assert(roicProxy(500, 0) === 100, 'fallback inesperado')
  assert(close(roicProxy(500, 1000), 50), 'ROIC 50% esperado')
})

test('shareRegional — extrai UF do endereço e converte em %', () => {
  const c = [
    { endereco: 'Rua X, Sorriso MT' },
    { endereco: 'Av Y, Cuiabá MT' },
    { endereco: 'Av Z, Maringá PR' },
  ]
  const s = shareRegionalFromContratos(c)
  assert(close(s.MT, 66.7, 0.1), `MT esperado ~66.7%, got ${s.MT}`)
  assert(close(s.PR, 33.3, 0.1), `PR esperado ~33.3%, got ${s.PR}`)
})

test('hitRate corretor — 6/10 = 60%', () => {
  assert(hitRate(10, 6) === 60, 'hit rate incorreto')
  assert(hitRate(0, 0) === 0, 'sem propostas, hit rate = 0')
})

test('tempoMedioFechamento — média entre proposta.criadaEm e contrato.criadoEm', () => {
  const day = 86400000
  const c = [
    { propostaCriadaEm: new Date(Date.now() - 10 * day), criadoEm: new Date(Date.now() - 5 * day) }, // 5
    { propostaCriadaEm: new Date(Date.now() - 20 * day), criadoEm: new Date(Date.now() - 5 * day) }, // 15
  ]
  const t = tempoMedioFechamento(c)
  assert(close(t, 10, 0.1), `esperado ~10 dias, got ${t}`)
})

test('pontualidadeBoletos — 2 em dia / 3 pagos = 66.7%', () => {
  const b = [
    { vencimento: '2026-01-10', confirmadoEm: '2026-01-05' },
    { vencimento: '2026-02-10', confirmadoEm: '2026-02-09' },
    { vencimento: '2026-03-10', confirmadoEm: '2026-03-15' }, // atrasado
    { vencimento: '2026-04-10' }, // não pago
  ]
  const p = pontualidadeBoletos(b)
  assert(close(p, 66.6667, 0.01), `esperado 66.67%, got ${p}`)
})

test('mediana — vetores par e ímpar', () => {
  assert(mediana([1, 2, 3]) === 2, 'mediana ímpar')
  assert(mediana([1, 2, 3, 4]) === 2.5, 'mediana par')
  assert(mediana([]) === 0, 'mediana vazia')
})

test('benchmark ranking — minha posição em comissão', () => {
  const stats = [
    { id: 'a', comissao: 1000, volume: 50 },
    { id: 'b', comissao: 3000, volume: 200 },
    { id: 'c', comissao: 2000, volume: 100 },
  ]
  assert(rankByDesc(stats, 'comissao', 'b') === 1, 'b deveria ser #1')
  assert(rankByDesc(stats, 'comissao', 'c') === 2, 'c deveria ser #2')
  assert(rankByDesc(stats, 'comissao', 'a') === 3, 'a deveria ser #3')
  assert(rankByDesc(stats, 'comissao', 'inexistente') === null, 'null pra id ausente')
})

test('benchmark mínimo 3 participantes — abaixo disso retorna habilitado=false', () => {
  // simulação simplificada da política do benchmarkMercado
  function gate(participantes) {
    return participantes >= 3
  }
  assert(gate(2) === false, 'com 2 deve ficar desabilitado')
  assert(gate(3) === true, 'com 3 já libera')
})

test('produtor: contratos ativos = sem dataFim ou dataFim no futuro', () => {
  const now = new Date()
  const future = new Date(now.getTime() + 86400000 * 30)
  const past = new Date(now.getTime() - 86400000 * 30)
  const c = [
    { dataFim: null }, { dataFim: future }, { dataFim: past },
  ]
  const ativos = c.filter((x) => !x.dataFim || x.dataFim > now).length
  assert(ativos === 2, `esperado 2 ativos, got ${ativos}`)
})

console.log(`\nResumo: ${passed} OK, ${failed} FAIL`)
process.exit(failed === 0 ? 0 : 1)
